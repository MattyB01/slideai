"""
SlideAI PPTX Parser
Extracts slide data from PPTX files using python-pptx.
Converts to SlidePresentation JSON format matching ~/slideai/types/slide.ts.
"""

import io
import re
import base64
import uuid
import logging
from typing import Any, Dict, List, Optional, Tuple

from pptx import Presentation
from pptx.util import Emu
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# Default slide dimensions in EMU (10 in × 7.5 in)
DEFAULT_SLIDE_WIDTH_EMU = 12192000
DEFAULT_SLIDE_HEIGHT_EMU = 6858000


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _new_id() -> str:
    """Generate a UUID4 string."""
    return str(uuid.uuid4())


def emu_to_percentage(emu_value: int, total_emu: int) -> float:
    """Convert an EMU coordinate to a percentage of the slide dimension."""
    if not total_emu:
        return 0.0
    return round((emu_value / total_emu) * 100, 4)


def _safe_text_runs(paragraph) -> List[Any]:
    """Safely get runs from a paragraph, handling empty paragraphs."""
    try:
        return list(paragraph.runs)
    except Exception:
        return []


def _extract_color_from_fill(fill) -> Optional[str]:
    """Extract a hex colour string from a fill object."""
    try:
        if fill.type is None:
            return None
        # SOLID_FILL = 1
        if fill.type == 1:
            try:
                fc = fill.fore_color
                if fc.type is not None:
                    try:
                        color_str = str(fc.rgb)
                        if color_str and len(color_str) == 6:
                            return f"#{color_str}"
                    except Exception:
                        pass
                    try:
                        tc = fc.theme_color
                        return f"theme:{tc}"
                    except Exception:
                        pass
            except Exception:
                pass
    except Exception:
        pass
    return None


def _extract_paragraph_font_color(paragraph) -> Optional[str]:
    """Extract colour from paragraph-level font, returning hex or theme string."""
    try:
        pf = paragraph.font
        if pf.color and pf.color.type is not None:
            try:
                rgb = pf.color.rgb
                return f"#{rgb}"
            except Exception:
                pass
            try:
                tc = pf.color.theme_color
                return f"theme:{tc}"
            except Exception:
                pass
    except Exception:
        pass
    return None


def _extract_run_font_color(run) -> Optional[str]:
    """Extract colour from a text run, returning hex or theme string."""
    try:
        font = run.font
        if font.color and font.color.type is not None:
            try:
                rgb = font.color.rgb
                return f"#{rgb}"
            except Exception:
                pass
            try:
                tc = font.color.theme_color
                return f"theme:{tc}"
            except Exception:
                pass
    except Exception:
        pass
    return None


def _get_color_str(font_obj) -> Optional[str]:
    """Extract colour from a font object (run or paragraph), returning a hex or theme string."""
    try:
        if font_obj.color and font_obj.color.type is not None:
            try:
                rgb = font_obj.color.rgb
                return f"#{rgb}"
            except Exception:
                pass
            try:
                tc = font_obj.color.theme_color
                return f"theme:{tc}"
            except Exception:
                pass
    except Exception:
        pass
    return None


def _get_font_size_pt(font_obj) -> Optional[float]:
    """Extract font size in points from a font object (run or paragraph)."""
    try:
        sz = font_obj.size
        if sz is not None:
            return round(sz.pt, 1)
    except Exception:
        pass
    return None


def _get_font_name(font_obj) -> Optional[str]:
    """Extract font name from a font object (run or paragraph)."""
    try:
        return font_obj.name
    except Exception:
        return None


def _get_formatted_text_content(paragraph, master_defaults: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Extract text and formatting from a paragraph, falling back from run to paragraph level.
    
    Falls back through: run → paragraph → master_defaults (slide master txStyles).
    """
    text = ""
    font_family = None
    font_size = None
    color = None
    bold = False
    italic = False

    runs = _safe_text_runs(paragraph)
    for run in runs:
        text += run.text
        # Try run-level formatting first
        if font_family is None:
            ff = _get_font_name(run)
            if ff:
                font_family = ff
        if font_size is None:
            fs = _get_font_size_pt(run)
            if fs:
                font_size = fs
        if color is None:
            c = _get_color_str(run)
            if c:
                color = c
        if run.font.bold:
            bold = True
        if run.font.italic:
            italic = True

    # Fall back to paragraph-level formatting if run-level was missing
    if (font_family is None or font_size is None or color is None) and runs:
        pf = paragraph.font
        if font_family is None:
            ff = _get_font_name(pf)
            if ff:
                font_family = ff
        if font_size is None:
            fs = _get_font_size_pt(pf)
            if fs:
                font_size = fs
        if color is None:
            c = _get_color_str(pf)
            if c:
                color = c

    # Handle paragraphs with no explicit runs (text in paragraph element directly)
    if not runs:
        text = paragraph.text
        pf = paragraph.font
        if font_family is None:
            ff = _get_font_name(pf)
            if ff:
                font_family = ff
        if font_size is None:
            fs = _get_font_size_pt(pf)
            if fs:
                font_size = fs
        if color is None:
            c = _get_color_str(pf)
            if c:
                color = c

    # Final fallback: master default text styles
    if master_defaults:
        if font_family is None:
            font_family = master_defaults.get("fontFamily")
        if font_size is None:
            font_size = master_defaults.get("fontSize")
        if color is None:
            color = master_defaults.get("color")

    return {
        "text": text,
        "fontFamily": font_family,
        "fontSize": font_size,
        "color": color or "#000000",
        "bold": bold,
        "italic": italic,
    }


def _get_alignment(paragraph) -> str:
    """Map paragraph alignment to left/center/right."""
    try:
        al = paragraph.alignment
        if al is None:
            return "left"
        # ppEnum value mapping: LEFT=0, CENTER=1, RIGHT=2
        if al == 0:
            return "left"
        elif al == 1:
            return "center"
        elif al == 2:
            return "right"
    except Exception:
        pass
    return "left"


def _content_type_to_ext(ct: str) -> str:
    """Map MIME content type to file extension."""
    mapping = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/svg+xml": "svg",
        "image/webp": "webp",
    }
    return mapping.get(ct, "png")


# ─── Theme Colour Resolution ──────────────────────────────────────────────────


def _build_theme_color_map(prs: Presentation) -> Dict[str, str]:
    """Build a map of theme color names to hex values from the theme XML."""
    color_map = {}
    try:
        # Access the theme part via the slide master
        if prs.slide_masters:
            master_part = prs.slide_masters[0].part
            # The theme is stored in the slide master's package part
            # python-pptx stores theme data internally
            theme_part = None
            for rel in master_part.rels.values():
                if "theme" in rel.reltype:
                    theme_part = rel.target_part
                    break

            if theme_part is None:
                return color_map

            theme_xml = theme_part._element.xml
            clr_scheme = theme_part._element.find(qn("a:clrScheme"))
            if clr_scheme is None:
                return color_map

            for child in clr_scheme:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                srgb = child.find(qn("a:srgbClr"))
                if srgb is not None:
                    color_map[tag.lower()] = f"#{srgb.get('val')}"
                else:
                    sysClr = child.find(qn("a:sysClr"))
                    if sysClr is not None:
                        color_map[tag.lower()] = sysClr.get("val", "#000000")
    except Exception as e:
        logger.debug(f"Failed to build theme color map: {e}")

    return color_map


def _resolve_theme_color(color_str: str, theme_color_map: Dict[str, str]) -> str:
    """Resolve a 'theme:DARK_1' or 'theme:DARK_1 (1)' string to a hex color."""
    if not color_str or not color_str.startswith("theme:"):
        return color_str

    # Strip the "theme:" prefix and any parenthetical suffix like " (1)"
    name = color_str[6:].split("(")[0].strip().lower()

    # Map theme color names to XML tag names
    theme_name_map = {
        "dk1": "dk1",
        "dark1": "dk1",
        "dark_1": "dk1",
        "lt1": "lt1",
        "light1": "lt1",
        "light_1": "lt1",
        "dk2": "dk2",
        "dark2": "dk2",
        "dark_2": "dk2",
        "lt2": "lt2",
        "light2": "lt2",
        "light_2": "lt2",
        "accent1": "accent1",
        "accent2": "accent2",
        "accent3": "accent3",
        "accent4": "accent4",
        "accent5": "accent5",
        "accent6": "accent6",
        "hlink": "hlink",
        "hyperlink": "hlink",
        "folhlink": "folhlink",
        "followedhyperlink": "folhlink",
    }

    tag = theme_name_map.get(name)
    if tag and tag in theme_color_map:
        return theme_color_map[tag]

    return "#000000"


def _resolve_all_theme_colors(data: Any, theme_color_map: Dict[str, str]) -> Any:
    """Recursively resolve theme:xxx color strings in a data structure."""
    if isinstance(data, dict):
        resolved = {}
        for k, v in data.items():
            if isinstance(v, str) and v.startswith("theme:"):
                resolved[k] = _resolve_theme_color(v, theme_color_map)
            else:
                resolved[k] = _resolve_all_theme_colors(v, theme_color_map)
        return resolved
    elif isinstance(data, list):
        return [_resolve_all_theme_colors(item, theme_color_map) for item in data]
    elif isinstance(data, str) and data.startswith("theme:"):
        return _resolve_theme_color(data, theme_color_map)
    return data


# ─── Background Extraction ────────────────────────────────────────────────────


def _extract_background_from_layout(slide) -> Optional[Dict[str, str]]:
    """Try to extract background from the slide's layout."""
    try:
        layout = slide.slide_layout
        bg = layout.background
        fill = bg.fill
        if fill.type is None:
            return None

        if fill.type == 1:
            color = _extract_color_from_fill(fill)
            if color:
                return {"type": "color", "value": color}

        if fill.type == 2:
            grad_str = _extract_gradient_string(fill)
            return {"type": "gradient", "value": grad_str}

        if fill.type in (3, 4):
            try:
                blip_elems = fill._fill.findall(".//" + qn("a:blip"))
                for blip in blip_elems:
                    r_id = blip.get(qn("r:embed")) or blip.get(
                        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
                    )
                    if r_id:
                        rel = layout.part.related_part(r_id)
                        blob = rel.blob
                        ct = getattr(rel, "content_type", "image/png")
                        b64 = base64.b64encode(blob).decode("utf-8")
                        return {
                            "type": "image",
                            "value": f"data:{ct};base64,{b64}",
                        }
            except Exception:
                pass
    except Exception:
        pass
    return None


def extract_background(
    slide, slide_width_emu: int, slide_height_emu: int, embed_images: bool = True
) -> Dict[str, str]:
    """
    Extract the background of a slide.

    Returns {"type": "color"|"gradient"|"image", "value": "..."}
    Tries slide level first, then falls back to layout level.
    """
    try:
        bg = slide.background
        fill = bg.fill
        if fill.type is not None:
            # SOLID_FILL
            if fill.type == 1:
                color = _extract_color_from_fill(fill)
                if color:
                    return {"type": "color", "value": color}

            # GRADIENT_FILL
            if fill.type == 2:
                grad_str = _extract_gradient_string(fill)
                return {"type": "gradient", "value": grad_str}

            # PICTURE_FILL / PATTERNED_FILL
            if fill.type in (3, 4) and embed_images:
                try:
                    blip_elems = fill._fill.findall(".//" + qn("a:blip"))
                    for blip in blip_elems:
                        r_id = blip.get(qn("r:embed")) or blip.get(
                            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
                        )
                        if r_id:
                            rel = slide.part.related_part(r_id)
                            blob = rel.blob
                            ct = getattr(rel, "content_type", "image/png")
                            b64 = base64.b64encode(blob).decode("utf-8")
                            return {
                                "type": "image",
                                "value": f"data:{ct};base64,{b64}",
                            }
                except Exception:
                    pass
                return {"type": "image", "value": ""}
    except Exception:
        pass

    # Fall back to layout-level background
    layout_bg = _extract_background_from_layout(slide)
    if layout_bg:
        return layout_bg

    return {"type": "color", "value": "#FFFFFF"}


def _extract_gradient_string(fill) -> str:
    """Try to build a CSS-ish gradient string from the fill XML."""
    try:
        grad_xml = fill._fill.find(qn("a:gradFill"))
        if grad_xml is None:
            return "linear-gradient(135deg, #333333, #FFFFFF)"

        # Determine gradient direction from lin or path element
        lin = grad_xml.find(qn("a:lin"))
        if lin is not None:
            ang = lin.get("ang", "5400000")  # default ~270°
            deg = round(int(ang) / 60000) % 360
            direction = f"{deg}deg"
        else:
            direction = "135deg"

        # Collect gradient stops
        gs_lst = grad_xml.find(qn("a:gsLst"))
        stops = []
        if gs_lst is not None:
            for gs in gs_lst.findall(qn("a:gs")):
                pos = gs.get("pos", "0")
                pos_pct = round(int(pos) / 1000, 1)
                srgb = gs.find(qn("a:srgbClr"))
                color = "#FFFFFF"
                if srgb is not None:
                    color = f"#{srgb.get('val', 'FFFFFF')}"
                stops.append(f"{color} {pos_pct}%")

        if stops:
            return f"linear-gradient({direction}, {', '.join(stops)})"
    except Exception:
        pass
    return "linear-gradient(135deg, #333333, #FFFFFF)"


# ─── Element Extraction ───────────────────────────────────────────────────────


def extract_text_element(
    shape, slide_width_emu: int, slide_height_emu: int,
    master_defaults: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convert a shape with a text frame into a TextElement dict.
    Also extracts the shape's fill color as backgroundColor if present.
    """
    tf = shape.text_frame
    paragraphs = list(tf.paragraphs)

    text_parts: List[str] = []
    font_family = None
    font_size = None
    color = None
    bold = False
    italic = False
    align = "left"
    line_spacing = 1.2

    for p in paragraphs:
        formatted = _get_formatted_text_content(p, master_defaults)
        text_parts.append(formatted["text"])

        # Use the FIRST paragraph's formatting as the element-level formatting
        if font_family is None and formatted["fontFamily"]:
            font_family = formatted["fontFamily"]
        if font_size is None and formatted["fontSize"]:
            font_size = formatted["fontSize"]
        if color is None and formatted["color"]:
            color = formatted["color"]
        if formatted["bold"]:
            bold = True
        if formatted["italic"]:
            italic = True

        # Per-paragraph alignment
        align = _get_alignment(p)

        # Line spacing from paragraph properties
        try:
            pPr = p._pPr
            if pPr is not None:
                lnSpc = pPr.find(qn("a:lnSpc"))
                if lnSpc is not None:
                    spcPct = lnSpc.find(qn("a:spcPct"))
                    if spcPct is not None:
                        val = int(spcPct.get("val", "100000"))
                        line_spacing = round(val / 100000, 2)
        except Exception:
            pass

    content = "\n".join(text_parts)

    # Extract shape fill as background color for the text element
    bg_color = None
    try:
        fill = shape.fill
        if fill.type == 1:  # SOLID_FILL
            color_from_fill = _extract_color_from_fill(fill)
            if color_from_fill:
                bg_color = color_from_fill
    except Exception:
        pass

    # Determine shape name for z-ordering
    try:
        shape_name = shape.name or ""
    except Exception:
        shape_name = ""

    return {
        "id": _new_id(),
        "type": "text",
        "x": emu_to_percentage(shape.left, slide_width_emu),
        "y": emu_to_percentage(shape.top, slide_height_emu),
        "width": emu_to_percentage(shape.width, slide_width_emu),
        "height": emu_to_percentage(shape.height, slide_height_emu),
        "rotation": 0,
        "zIndex": 0,
        "opacity": 1.0,
        "content": content,
        "fontSize": font_size or 14,
        "fontFamily": font_family or "Arial",
        "fontWeight": "bold" if bold else "normal",
        "fontStyle": "italic" if italic else "normal",
        "color": color or "#000000",
        "textAlign": align,
        "lineHeight": line_spacing,
        "backgroundColor": bg_color,
        "shapeName": shape_name,
    }


def extract_image_element(
    shape, slide_width_emu: int, slide_height_emu: int,
    embed_images: bool = True
) -> Dict[str, Any]:
    """
    Convert a picture shape into an ImageElement dict.
    Extracts the image as base64 data when embed_images is True.
    """
    src = ""
    alt = shape.name or "Image"
    if embed_images:
        try:
            image = shape.image
            blob = image.blob
            ct = image.content_type
            b64 = base64.b64encode(blob).decode("utf-8")
            src = f"data:{ct};base64,{b64}"
        except Exception as e:
            logger.warning(f"Could not extract image from shape '{shape.name}': {e}")
    else:
        src = "__PLACEHOLDER_IMAGE__"

    return {
        "id": _new_id(),
        "type": "image",
        "x": emu_to_percentage(shape.left, slide_width_emu),
        "y": emu_to_percentage(shape.top, slide_height_emu),
        "width": emu_to_percentage(shape.width, slide_width_emu),
        "height": emu_to_percentage(shape.height, slide_height_emu),
        "rotation": 0,
        "zIndex": 0,
        "opacity": 1.0,
        "src": src,
        "alt": alt,
        "objectFit": "cover",
        "source": "uploaded",
        "attribution": None,
    }


def _map_auto_shape_type(shape) -> str:
    """Map python-pptx auto shape types to our ShapeElement shape names."""
    try:
        ast = shape.auto_shape_type
        if ast == 1:
            return "rectangle"
        elif ast == 5:
            return "circle"
        elif ast == 9:
            return "triangle"
        elif ast == 15:
            return "line"
        else:
            name = str(ast).lower()
            if "rect" in name:
                return "rectangle"
            elif "oval" in name or "ellipse" in name or "circle" in name:
                return "circle"
            elif "tri" in name:
                return "triangle"
            elif "line" in name:
                return "line"
            return "rectangle"
    except Exception:
        pass
    return "rectangle"


def _extract_shape_fill(shape) -> str:
    """Extract the fill colour from a shape."""
    try:
        fill = shape.fill
        color = _extract_color_from_fill(fill)
        if color:
            return color
    except Exception:
        pass
    return "#CCCCCC"


def _has_significant_text(shape) -> bool:
    """Check if a shape has actual text content (not just empty paragraphs)."""
    try:
        if not shape.has_text_frame:
            return False
        text = shape.text_frame.text
        return bool(text and text.strip())
    except Exception:
        return False


def extract_shape_element(
    shape, slide_width_emu: int, slide_height_emu: int
) -> Dict[str, Any]:
    """
    Convert an auto shape (non-text, non-picture) into a ShapeElement dict.
    """
    shape_name = _map_auto_shape_type(shape)
    fill_color = _extract_shape_fill(shape)

    # Try to extract stroke
    stroke = None
    stroke_width = None
    try:
        ln = shape.line
        if ln.fill.type is not None:
            try:
                stroke = f"#{ln.color.rgb}"
            except Exception:
                pass
            try:
                stroke_width = round(ln.width.pt, 1) if ln.width else None
            except Exception:
                pass
    except Exception:
        pass

    return {
        "id": _new_id(),
        "type": "shape",
        "x": emu_to_percentage(shape.left, slide_width_emu),
        "y": emu_to_percentage(shape.top, slide_height_emu),
        "width": emu_to_percentage(shape.width, slide_width_emu),
        "height": emu_to_percentage(shape.height, slide_height_emu),
        "rotation": 0,
        "zIndex": 0,
        "opacity": 1.0,
        "shape": shape_name,
        "fill": fill_color,
        "stroke": stroke,
        "strokeWidth": stroke_width,
    }


def _process_shape(shape, slide_width_emu: int, slide_height_emu: int, embed_images: bool = True, master_defaults: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Process a single shape and return its element dict, or None if skipped."""
    try:
        shape_type = shape.shape_type

        # ── SmartArt / Chart / Diagram ────────────────────────
        if hasattr(shape, "has_chart") and shape.has_chart:
            return {
                "id": _new_id(),
                "type": "shape",
                "x": emu_to_percentage(shape.left, slide_width_emu),
                "y": emu_to_percentage(shape.top, slide_height_emu),
                "width": emu_to_percentage(shape.width, slide_width_emu),
                "height": emu_to_percentage(shape.height, slide_height_emu),
                "rotation": 0,
                "zIndex": 0,
                "opacity": 1.0,
                "shape": "rectangle",
                "fill": "#CCCCCC",
                "_note": "chart (unsupported - rendered as placeholder)",
            }

        # Check for SmartArt
        is_smart_art = False
        try:
            dgm = shape.element.find(qn("dgm:relIds"))
            if dgm is not None:
                is_smart_art = True
        except Exception:
            pass
        if not is_smart_art:
            try:
                mc_elem = shape.element.find(qn("mc:AlternateContent"))
                if mc_elem is not None:
                    dgm_fallback = mc_elem.find(".//" + qn("dgm:relIds"))
                    if dgm_fallback is not None:
                        is_smart_art = True
            except Exception:
                pass

        if is_smart_art:
            return {
                "id": _new_id(),
                "type": "shape",
                "x": emu_to_percentage(shape.left, slide_width_emu),
                "y": emu_to_percentage(shape.top, slide_height_emu),
                "width": emu_to_percentage(shape.width, slide_width_emu),
                "height": emu_to_percentage(shape.height, slide_height_emu),
                "rotation": 0,
                "zIndex": 0,
                "opacity": 1.0,
                "shape": "rectangle",
                "fill": "#CCCCCC",
                "_note": "smartart (unsupported - rendered as placeholder)",
            }

        # ── Table ────────────────────────────────────────────
        if shape_type == MSO_SHAPE_TYPE.TABLE or (
            hasattr(shape, "has_table") and shape.has_table
        ):
            return {
                "id": _new_id(),
                "type": "shape",
                "x": emu_to_percentage(shape.left, slide_width_emu),
                "y": emu_to_percentage(shape.top, slide_height_emu),
                "width": emu_to_percentage(shape.width, slide_width_emu),
                "height": emu_to_percentage(shape.height, slide_height_emu),
                "rotation": 0,
                "zIndex": 0,
                "opacity": 1.0,
                "shape": "rectangle",
                "fill": "#FFFFFF",
                "_note": "table",
            }

        # ── Picture / Image ──────────────────────────────────
        if shape_type == MSO_SHAPE_TYPE.PICTURE:
            return extract_image_element(shape, slide_width_emu, slide_height_emu, embed_images=embed_images)

        # ── Group shape ──────────────────────────────────────
        if shape_type == MSO_SHAPE_TYPE.GROUP:
            return {
                "id": _new_id(),
                "type": "shape",
                "x": emu_to_percentage(shape.left, slide_width_emu),
                "y": emu_to_percentage(shape.top, slide_height_emu),
                "width": emu_to_percentage(shape.width, slide_width_emu),
                "height": emu_to_percentage(shape.height, slide_height_emu),
                "rotation": 0,
                "zIndex": 0,
                "opacity": 1.0,
                "shape": "rectangle",
                "fill": "#EEEEEE",
                "_note": "group",
            }

        # ── Auto shape / Text box / Placeholder ──────────────
        # KEY FIX: Check if the shape has actual text content.
        # Shapes with a text frame but empty text (e.g. decorative rectangles)
        # should be treated as ShapeElements, not TextElements.
        has_text = _has_significant_text(shape)

        if has_text:
            # Extract text element, but also include fill color if present
            return extract_text_element(shape, slide_width_emu, slide_height_emu, master_defaults)

        # No significant text → treat as shape
        return extract_shape_element(shape, slide_width_emu, slide_height_emu)

    except Exception as e:
        logger.warning(
            f"Error processing shape '{getattr(shape, 'name', '?')}': {e}"
        )
        return None


# ─── Theme Extraction ─────────────────────────────────────────────────────────


def _extract_theme(prs: Presentation) -> Dict[str, Any]:
    """
    Try to extract theme colours and fonts from the presentation's theme part.
    Falls back to sensible defaults.
    """
    theme = {
        "primaryColor": "#0078D4",
        "secondaryColor": "#106EBE",
        "accentColor": "#FFB900",
        "backgroundColor": "#FFFFFF",
        "fontTitle": "Arial",
        "fontBody": "Arial",
        "borderRadius": 8,
    }

    try:
        # Access the theme part via the slide master
        if not prs.slide_masters:
            return theme

        master_part = prs.slide_masters[0].part
        for rel in master_part.rels.values():
            if "theme" in rel.reltype:
                theme_part = rel.target_part
                theme_xml = theme_part._element.xml
                break
        else:
            return theme

        # Extract color scheme from theme XML
        clr_scheme = theme_part._element.find(qn("a:clrScheme"))
        if clr_scheme is not None:
            color_map = {}
            for child in clr_scheme:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                srgb = child.find(qn("a:srgbClr"))
                if srgb is not None:
                    color_map[tag.lower()] = f"#{srgb.get('val')}"

            if "dk1" in color_map:
                theme["primaryColor"] = color_map["dk1"]
            if "dk2" in color_map:
                theme["secondaryColor"] = color_map["dk2"]
            if "accent1" in color_map:
                theme["accentColor"] = color_map["accent1"]
            if "lt1" in color_map:
                theme["backgroundColor"] = color_map["lt1"]

        # Extract font scheme
        font_scheme = theme_part._element.find(qn("a:fontScheme"))
        if font_scheme is not None:
            major_font = font_scheme.find(qn("a:majorFont"))
            minor_font = font_scheme.find(qn("a:minorFont"))
            if major_font is not None:
                latin = major_font.find(qn("a:latin"))
                if latin is not None and latin.get("typeface"):
                    theme["fontTitle"] = latin.get("typeface")
            if minor_font is not None:
                latin = minor_font.find(qn("a:latin"))
                if latin is not None and latin.get("typeface"):
                    theme["fontBody"] = latin.get("typeface")

    except Exception as e:
        logger.debug(f"Theme extraction failed (using defaults): {e}")

    return theme


# ─── Master Default Text Styles ──────────────────────────────────────────────


def _extract_master_default_font(prs: Presentation) -> Dict[str, Any]:
    """Extract default font settings from the slide master's txStyles.
    
    This is the deepest fallback for text formatting — used when both
    run-level and paragraph-level formatting are missing (common in
    Google Slides exports).
    """
    defaults = {
        "fontFamily": None,
        "fontSize": None,
        "color": None,
    }
    
    try:
        if not prs.slide_masters:
            return defaults
        
        master = prs.slide_masters[0]
        txStyles = master.element.find(qn("p:txStyles"))
        if txStyles is None:
            return defaults
        
        # Check bodyStyle first (most common for body text), then titleStyle
        for style_name in ["p:bodyStyle", "p:titleStyle", "p:otherStyle"]:
            style = txStyles.find(qn(style_name))
            if style is None:
                continue
            
            # Try lvl1pPr first (most common)
            for pPr_path in ["a:lvl1pPr", "a:defPPr"]:
                pPr = style.find(qn(pPr_path))
                if pPr is None:
                    continue
                defRPr = pPr.find(qn("a:defRPr"))
                if defRPr is None:
                    continue
                
                if defaults["fontSize"] is None and defRPr.get("sz"):
                    try:
                        # sz is in hundredths of a point
                        pt = int(defRPr.get("sz")) / 100
                        if pt > 0:
                            defaults["fontSize"] = round(pt, 1)
                    except (ValueError, TypeError):
                        pass
                
                if defaults["fontFamily"] is None:
                    latin = defRPr.find(qn("a:latin"))
                    if latin is not None and latin.get("typeface"):
                        defaults["fontFamily"] = latin.get("typeface")
                
                if defaults["color"] is None:
                    solidFill = defRPr.find(qn("a:solidFill"))
                    if solidFill is not None:
                        srgb = solidFill.find(qn("a:srgbClr"))
                        if srgb is not None:
                            defaults["color"] = f"#{srgb.get('val')}"
                        else:
                            scheme = solidFill.find(qn("a:schemeClr"))
                            if scheme is not None:
                                defaults["color"] = f"scheme:{scheme.get('val')}"
            
            # If we found at least some defaults, stop looking
            if defaults["fontFamily"] or defaults["fontSize"]:
                break
    except Exception as e:
        logger.debug(f"Failed to extract master font defaults: {e}")
    
    return defaults


# ─── Main Parse Entry Point ─────────────────────────────────────────────────--


def parse_pptx(file_path: str, embed_images: bool = True) -> Dict[str, Any]:
    """
    Parse a .pptx file and produce a full SlidePresentation JSON dict.

    Args:
        file_path: Path to the .pptx file on disk.
        embed_images: If True, embed images as base64 data URIs.
                      If False, use a placeholder string for images.

    Returns:
        Dict matching the SlidePresentation TypeScript interface.
    """
    prs = Presentation(file_path)

    slide_width_emu = prs.slide_width or DEFAULT_SLIDE_WIDTH_EMU
    slide_height_emu = prs.slide_height or DEFAULT_SLIDE_HEIGHT_EMU

    # Build theme color map for resolving theme:xxx colors
    theme_color_map = _build_theme_color_map(prs)

    # Extract slide master default text styles for deep fallback
    master_defaults = _extract_master_default_font(prs)

    slides_data: List[Dict[str, Any]] = []

    for idx, slide in enumerate(prs.slides):
        background = extract_background(slide, slide_width_emu, slide_height_emu, embed_images=embed_images)
        # Resolve theme colors in background
        background = _resolve_all_theme_colors(background, theme_color_map)

        elements: List[Dict[str, Any]] = []

        for shape in slide.shapes:
            element = _process_shape(shape, slide_width_emu, slide_height_emu, embed_images=embed_images, master_defaults=master_defaults)
            if element is not None:
                # Resolve theme colors in element properties
                element = _resolve_all_theme_colors(element, theme_color_map)
                elements.append(element)

        # ── Speaker notes ────────────────────────────────────────────
        speaker_notes = ""
        try:
            if slide.has_notes_slide:
                ns = slide.notes_slide
                ntf = ns.notes_text_frame
                if ntf is not None:
                    speaker_notes = ntf.text
        except Exception:
            pass

        slides_data.append(
            {
                "id": _new_id(),
                "index": idx,
                "background": background,
                "elements": elements,
                "speakerNotes": speaker_notes,
            }
        )

    # ── Assemble the final SlidePresentation ─────────────────────────
    theme = _extract_theme(prs)

    # Determine a title from the file name or first slide text
    title = file_path.split("/")[-1].replace(".pptx", "").replace("_", " ").replace("-", " ").title()

    result: Dict[str, Any] = {
        "id": _new_id(),
        "title": title,
        "theme": theme,
        "slides": slides_data,
    }

    # Resolve theme font references like "+mn-lt" to actual font names
    def _resolve_theme_fonts(data):
        if isinstance(data, dict):
            resolved = {}
            for k, v in data.items():
                if isinstance(v, str) and v.startswith("+") and "-" in v:
                    if v in ("+mn-lt", "+mn-ea"):
                        resolved[k] = theme.get("fontBody", "Arial")
                    elif v in ("+mj-lt", "+mj-ea"):
                        resolved[k] = theme.get("fontTitle", "Arial")
                    else:
                        resolved[k] = v
                else:
                    resolved[k] = _resolve_theme_fonts(v)
            return resolved
        elif isinstance(data, list):
            return [_resolve_theme_fonts(item) for item in data]
        return data
    
    result = _resolve_theme_fonts(result)

    return result


def parse_pptx_from_bytes(data: bytes, filename: str = "presentation.pptx", embed_images: bool = True) -> Dict[str, Any]:
    """
    Parse a .pptx file from raw bytes.

    Args:
        data: Raw bytes of the .pptx file.
        filename: Original filename (for title extraction).
        embed_images: If True, embed images as base64 data URIs.

    Returns:
        Dict matching the SlidePresentation TypeScript interface.
    """
    import tempfile
    import os

    # Write to temp file because python-pptx needs a file path
    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        result = parse_pptx(tmp_path, embed_images=embed_images)
        # Override title with the original filename
        if filename:
            title = filename.replace(".pptx", "").replace("_", " ").replace("-", " ").title()
            result["title"] = title
        return result
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
