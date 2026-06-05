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


def _get_color_str(run) -> str:
    """Extract colour from a text run, returning a hex or theme string."""
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
    return "#000000"


def _get_font_size_pt(run) -> Optional[float]:
    """Extract font size in points from a run."""
    try:
        sz = run.font.size
        if sz is not None:
            return round(sz.pt, 1)
    except Exception:
        pass
    return None


def _get_font_name(run) -> Optional[str]:
    """Extract font name from a run."""
    try:
        return run.font.name
    except Exception:
        return None


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


# ─── Background Extraction ────────────────────────────────────────────────────


def extract_background(
    slide, slide_width_emu: int, slide_height_emu: int
) -> Dict[str, str]:
    """
    Extract the background of a slide.

    Returns {"type": "color"|"gradient"|"image", "value": "..."}
    """
    try:
        bg = slide.background
        fill = bg.fill
        if fill.type is None:
            return {"type": "color", "value": "#FFFFFF"}

        # SOLID_FILL
        if fill.type == 1:
            color = _extract_color_from_fill(fill)
            if color:
                return {"type": "color", "value": color}
            return {"type": "color", "value": "#FFFFFF"}

        # GRADIENT_FILL
        if fill.type == 2:
            # Try to construct a gradient string from the fill XML
            grad_str = _extract_gradient_string(fill)
            return {"type": "gradient", "value": grad_str}

        # PICTURE_FILL / PATTERNED_FILL
        if fill.type in (3, 4):
            try:
                xml = fill._fill.xml
                blip_elems = list(
                    fill._fill.findall(
                        qn("a:blipFill") + "/" + qn("a:blip")
                    )
                ) or list(
                    fill._fill.findall(qn("a:blip"))
                )
                # Also try parent-level blip
                if not blip_elems:
                    blip_elems = fill._fill.findall(
                        ".//" + qn("a:blip")
                    )
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
    shape, slide_width_emu: int, slide_height_emu: int
) -> Dict[str, Any]:
    """
    Convert a shape with a text frame into a TextElement dict.
    """
    tf = shape.text_frame
    paragraphs = list(tf.paragraphs)

    # Accumulate text content and formatting from all runs
    text_parts: List[str] = []
    font_family = None
    font_size = None
    color = "#000000"
    bold = False
    italic = False
    align = "left"
    line_spacing = 1.2

    for p in paragraphs:
        p_text = ""
        runs = _safe_text_runs(p)
        for run in runs:
            p_text += run.text
            # Pull formatting from first run that has it
            if font_family is None:
                ff = _get_font_name(run)
                if ff:
                    font_family = ff
            if font_size is None:
                fs = _get_font_size_pt(run)
                if fs:
                    font_size = fs
            if color == "#000000" or color is None:
                c = _get_color_str(run)
                if c:
                    color = c
            if run.font.bold:
                bold = True
            if run.font.italic:
                italic = True

        text_parts.append(p_text)

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
        "fontSize": font_size or 18,
        "fontFamily": font_family or "Arial",
        "fontWeight": "bold" if bold else "normal",
        "fontStyle": "italic" if italic else "normal",
        "color": color,
        "textAlign": align,
        "lineHeight": line_spacing,
    }


def extract_image_element(
    shape, slide_width_emu: int, slide_height_emu: int
) -> Dict[str, Any]:
    """
    Convert a picture shape into an ImageElement dict.
    Extracts the image as base64 data.
    """
    src = ""
    alt = shape.name or "Image"
    try:
        image = shape.image
        blob = image.blob
        ct = image.content_type
        b64 = base64.b64encode(blob).decode("utf-8")
        src = f"data:{ct};base64,{b64}"
    except Exception as e:
        logger.warning(f"Could not extract image from shape '{shape.name}': {e}")

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
        # Common types:
        # 1  = MSO_SHAPE.RECTANGLE
        # 5  = MSO_SHAPE.OVAL
        # 9  = MSO_SHAPE.ISOSCELES_TRIANGLE
        # 15 = MSO_SHAPE.LINE (freeform / line)
        if ast == 1:
            return "rectangle"
        elif ast == 5:
            return "circle"
        elif ast == 9:
            return "triangle"
        elif ast == 15:
            return "line"
        else:
            # Try name-based mapping
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


# ─── Main Parse Entry Point ───────────────────────────────────────────────────


def _extract_theme(prs: Presentation) -> Dict[str, Any]:
    """
    Try to extract theme colours and fonts from the presentation's slide master.
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
        # Access theme from slide master XML
        for slide_master in prs.slide_masters:
            theme_elem = slide_master.element.find(
                qn("p:clrMap")
            )
            # Get the theme override / theme element
            # The actual theme is at the presentation part's theme part
            break

        # Try to get theme from the presentation
        # python-pptx stores theme in prs.slide_masters[0].element
        if prs.slide_masters:
            master = prs.slide_masters[0]
            # Try to find clrScheme in the theme
            theme_xml = master.element.xml
            import re as _re

            # Extract colour scheme from theme XML
            # Look for <a:clrScheme name="...">
            clr_match = _re.search(
                r'<a:clrScheme[^>]*name="([^"]+)"',
                theme_xml,
            )
            if clr_match:
                theme["primaryColor"] = _extract_theme_color(
                    theme_xml, "dk1"
                ) or theme["primaryColor"]
                theme["secondaryColor"] = _extract_theme_color(
                    theme_xml, "dk2"
                ) or theme["secondaryColor"]
                theme["accentColor"] = _extract_theme_color(
                    theme_xml, "accent1"
                ) or theme["accentColor"]
                theme["backgroundColor"] = _extract_theme_color(
                    theme_xml, "lt1"
                ) or theme["backgroundColor"]

            # Extract font scheme
            major_font = _extract_theme_font(theme_xml, "major")
            minor_font = _extract_theme_font(theme_xml, "minor")
            if major_font:
                theme["fontTitle"] = major_font
            if minor_font:
                theme["fontBody"] = minor_font

    except Exception as e:
        logger.debug(f"Theme extraction failed (using defaults): {e}")

    return theme


def _extract_theme_color(xml: str, name: str) -> Optional[str]:
    """Extract an sRGB colour from a theme colour scheme by colour name."""
    import re as _re

    # Look for <a:dk1>, <a:lt1>, <a:accent1>, etc.
    pattern = (
        r"<a:"
        + re.escape(name)
        + r"[^>]*>.*?<a:srgbClr val=\"([A-Fa-f0-9]{6})\".*?</a:"
        + re.escape(name)
        + r">"
    )
    match = _re.search(pattern, xml, re.DOTALL)
    if match:
        return f"#{match.group(1)}"
    return None


def _extract_theme_font(xml: str, scheme: str) -> Optional[str]:
    """Extract a font name from the theme font scheme (major/minor)."""
    import re as _re

    # Look for <a:majorFont> or <a:minorFont>
    pattern = (
        r"<a:"
        + re.escape(scheme)
        + r"Font[^>]*>.*?<a:latin[^>]*typeface=\"([^\"]+)\".*?</a:"
        + re.escape(scheme)
        + r"Font>"
    )
    match = _re.search(pattern, xml, re.DOTALL)
    if match:
        return match.group(1)
    return None


def parse_pptx(file_path: str) -> Dict[str, Any]:
    """
    Parse a .pptx file and produce a full SlidePresentation JSON dict.

    Args:
        file_path: Path to the .pptx file on disk.

    Returns:
        Dict matching the SlidePresentation TypeScript interface.
    """
    prs = Presentation(file_path)

    slide_width_emu = prs.slide_width or DEFAULT_SLIDE_WIDTH_EMU
    slide_height_emu = prs.slide_height or DEFAULT_SLIDE_HEIGHT_EMU

    slides_data: List[Dict[str, Any]] = []

    for idx, slide in enumerate(prs.slides):
        background = extract_background(slide, slide_width_emu, slide_height_emu)
        elements: List[Dict[str, Any]] = []

        for shape in slide.shapes:
            try:
                shape_type = shape.shape_type

                # ── SmartArt / Chart / Diagram ────────────────────────
                # Check for chart first (has_chart attribute)
                if hasattr(shape, "has_chart") and shape.has_chart:
                    elements.append(
                        {
                            "id": _new_id(),
                            "type": "shape",
                            "x": emu_to_percentage(
                                shape.left, slide_width_emu
                            ),
                            "y": emu_to_percentage(
                                shape.top, slide_height_emu
                            ),
                            "width": emu_to_percentage(
                                shape.width, slide_width_emu
                            ),
                            "height": emu_to_percentage(
                                shape.height, slide_height_emu
                            ),
                            "rotation": 0,
                            "zIndex": 0,
                            "opacity": 1.0,
                            "shape": "rectangle",
                            "fill": "#CCCCCC",
                            "_note": "chart (unsupported - rendered as placeholder)",
                        }
                    )
                    continue

                # Check for SmartArt / diagram via XML namespace
                is_smart_art = False
                try:
                    dgm = shape.element.find(
                        qn("dgm:relIds")
                    )
                    if dgm is not None:
                        is_smart_art = True
                except Exception:
                    pass
                # Another check: look for mc:AlternateContent with dgm namespace
                if not is_smart_art:
                    try:
                        mc_elem = shape.element.find(
                            qn("mc:AlternateContent")
                        )
                        if mc_elem is not None:
                            dgm_fallback = mc_elem.find(
                                ".//" + qn("dgm:relIds")
                            )
                            if dgm_fallback is not None:
                                is_smart_art = True
                    except Exception:
                        pass

                if is_smart_art:
                    elements.append(
                        {
                            "id": _new_id(),
                            "type": "shape",
                            "x": emu_to_percentage(
                                shape.left, slide_width_emu
                            ),
                            "y": emu_to_percentage(
                                shape.top, slide_height_emu
                            ),
                            "width": emu_to_percentage(
                                shape.width, slide_width_emu
                            ),
                            "height": emu_to_percentage(
                                shape.height, slide_height_emu
                            ),
                            "rotation": 0,
                            "zIndex": 0,
                            "opacity": 1.0,
                            "shape": "rectangle",
                            "fill": "#CCCCCC",
                            "_note": "smartart (unsupported - rendered as placeholder)",
                        }
                    )
                    continue

                # ── Table ────────────────────────────────────────────
                if shape_type == MSO_SHAPE_TYPE.TABLE or (
                    hasattr(shape, "has_table") and shape.has_table
                ):
                    elements.append(
                        {
                            "id": _new_id(),
                            "type": "shape",
                            "x": emu_to_percentage(
                                shape.left, slide_width_emu
                            ),
                            "y": emu_to_percentage(
                                shape.top, slide_height_emu
                            ),
                            "width": emu_to_percentage(
                                shape.width, slide_width_emu
                            ),
                            "height": emu_to_percentage(
                                shape.height, slide_height_emu
                            ),
                            "rotation": 0,
                            "zIndex": 0,
                            "opacity": 1.0,
                            "shape": "rectangle",
                            "fill": "#FFFFFF",
                            "_note": "table",
                        }
                    )
                    continue

                # ── Picture / Image ──────────────────────────────────
                if shape_type == MSO_SHAPE_TYPE.PICTURE:
                    elements.append(
                        extract_image_element(
                            shape, slide_width_emu, slide_height_emu
                        )
                    )
                    continue

                # ── Group shape ──────────────────────────────────────
                if shape_type == MSO_SHAPE_TYPE.GROUP:
                    # Could recursively expand group members;
                    # for now, add as a placeholder rectangle
                    elements.append(
                        {
                            "id": _new_id(),
                            "type": "shape",
                            "x": emu_to_percentage(
                                shape.left, slide_width_emu
                            ),
                            "y": emu_to_percentage(
                                shape.top, slide_height_emu
                            ),
                            "width": emu_to_percentage(
                                shape.width, slide_width_emu
                            ),
                            "height": emu_to_percentage(
                                shape.height, slide_height_emu
                            ),
                            "rotation": 0,
                            "zIndex": 0,
                            "opacity": 1.0,
                            "shape": "rectangle",
                            "fill": "#EEEEEE",
                            "_note": "group",
                        }
                    )
                    continue

                # ── Placeholder ──────────────────────────────────────
                if shape_type == MSO_SHAPE_TYPE.PLACEHOLDER:
                    if shape.has_text_frame:
                        elements.append(
                            extract_text_element(
                                shape, slide_width_emu, slide_height_emu
                            )
                        )
                    else:
                        elements.append(
                            extract_shape_element(
                                shape, slide_width_emu, slide_height_emu
                            )
                        )
                    continue

                # ── Auto shape (freeform, rectangle, oval, etc.) ─────
                if shape_type in (
                    MSO_SHAPE_TYPE.AUTO_SHAPE,
                    MSO_SHAPE_TYPE.FREEFORM,
                    MSO_SHAPE_TYPE.TEXT_BOX,
                ):
                    if shape.has_text_frame:
                        elements.append(
                            extract_text_element(
                                shape, slide_width_emu, slide_height_emu
                            )
                        )
                    else:
                        elements.append(
                            extract_shape_element(
                                shape, slide_width_emu, slide_height_emu
                            )
                        )
                    continue

                # ── Fallback ─────────────────────────────────────────
                # Any other shape type: try text, else shape
                if shape.has_text_frame:
                    elements.append(
                        extract_text_element(
                            shape, slide_width_emu, slide_height_emu
                        )
                    )
                else:
                    elements.append(
                        extract_shape_element(
                            shape, slide_width_emu, slide_height_emu
                        )
                    )

            except Exception as e:
                logger.warning(
                    f"Error processing shape '{getattr(shape, 'name', '?')}' "
                    f"on slide {idx}: {e}"
                )
                continue

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

    return result


def parse_pptx_from_bytes(data: bytes, filename: str = "presentation.pptx") -> Dict[str, Any]:
    """
    Parse a .pptx file from raw bytes.

    Args:
        data: Raw bytes of the .pptx file.
        filename: Original filename (for title extraction).

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
        result = parse_pptx(tmp_path)
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
