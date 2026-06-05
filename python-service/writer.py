"""
SlideAI PPTX Writer
Builds .pptx files from SlidePresentation JSON.
"""

import io
import re
import base64
import logging
import os
import tempfile
import uuid
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from pptx import Presentation
from pptx.util import Inches, Emu, Pt, Cm
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn, nsmap
from pptx.oxml import parse_xml

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

# Slide dimensions in EMU (standard 10 in × 7.5 in)
SLIDE_WIDTH_EMU = 12192000
SLIDE_HEIGHT_EMU = 6858000

# Max image download size (10 MB)
MAX_IMAGE_SIZE = 10 * 1024 * 1024

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _new_id() -> str:
    return str(uuid.uuid4())


def pct_to_emu(pct: float, total_emu: int) -> int:
    """Convert a percentage to EMU based on the slide dimension."""
    return int(round(pct / 100.0 * total_emu))


def _hex_to_rgb(hex_str: str) -> RGBColor:
    """Convert a hex colour string (#RRGGBB) to an RGBColor."""
    h = hex_str.lstrip("#")
    if len(h) == 6:
        return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return RGBColor(0, 0, 0)


def _is_base64_data_uri(s: str) -> bool:
    """Check if a string is a data URI with base64-encoded data."""
    return s.startswith("data:") and ";base64," in s


def _is_url(s: str) -> bool:
    """Check if a string looks like an HTTP/HTTPS URL."""
    try:
        parsed = urlparse(s)
        return parsed.scheme in ("http", "https")
    except Exception:
        return False


def _decode_base64_data_uri(uri: str) -> Tuple[bytes, str]:
    """Decode a data: URI into bytes and content type."""
    # Format: data:[<mediatype>][;base64],<data>
    match = re.match(r"data:([^;]+);base64,(.+)", uri)
    if not match:
        raise ValueError("Invalid data URI format")
    content_type = match.group(1)
    b64_data = match.group(2)
    raw = base64.b64decode(b64_data)
    return raw, content_type


def _resolve_image_data(src: str) -> Tuple[bytes, str]:
    """
    Resolve an image source to (bytes, content_type).

    Supports:
      - data: URIs (base64)
      - HTTP/HTTPS URLs (downloaded)
      - Local file paths
    """
    if _is_base64_data_uri(src):
        return _decode_base64_data_uri(src)
    elif _is_url(src):
        return _download_image(src)
    else:
        # Assume local file path
        if os.path.isfile(src):
            with open(src, "rb") as f:
                data = f.read()
            ext = os.path.splitext(src)[1].lower()
            ct_map = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".bmp": "image/bmp",
            }
            ct = ct_map.get(ext, "image/png")
            return data, ct
        raise ValueError(f"Cannot resolve image source: {src[:80]}...")


def _download_image(url: str) -> Tuple[bytes, str]:
    """Download an image from a URL with size limit."""
    try:
        import httpx
        resp = httpx.get(url, follow_redirects=True, timeout=30.0)
        resp.raise_for_status()
        data = resp.content
        if len(data) > MAX_IMAGE_SIZE:
            logger.warning(f"Image too large ({len(data)} bytes), truncating")
            data = data[:MAX_IMAGE_SIZE]
        ct = resp.headers.get("content-type", "image/png")
        return data, ct
    except ImportError:
        raise RuntimeError("httpx is required to download images from URLs")
    except Exception as e:
        raise ValueError(f"Failed to download image from {url}: {e}")


# ─── Theme Application ────────────────────────────────────────────────────────


def _apply_theme(prs: Presentation, theme: Dict[str, Any]) -> None:
    """
    Apply theme colors and fonts to the presentation's slide master.
    Modifies the theme XML directly.
    """
    try:
        # Get the theme part from the first slide master
        if not prs.slide_masters:
            return
        master = prs.slide_masters[0]

        # Find the <a:theme> element in the slide master's XML
        # It's usually nested in <p:officeArt> or similar
        theme_elem = master.element.find(
            ".//" + qn("a:theme")
        )
        if theme_elem is None:
            # Try to find via the themeOverride element
            theme_elem = master.element.find(
                ".//" + qn("a:themeOverride")
            )
            if theme_elem is None:
                # Create a theme element if none exists
                # Actually, let's just set properties on the slide level instead
                logger.debug("No theme element found, skipping theme application")
                return

        # Find or create the clrScheme
        clr_scheme = theme_elem.find(qn("a:clrScheme"))
        if clr_scheme is None:
            # Try finding it via themeOverride
            clr_scheme = master.element.find(
                ".//" + qn("a:clrScheme")
            )
        if clr_scheme is None:
            logger.debug("No clrScheme found, cannot apply theme colors")
        else:
            _set_theme_color(clr_scheme, "dk1", theme.get("primaryColor", "#000000"))
            _set_theme_color(clr_scheme, "lt1", theme.get("backgroundColor", "#FFFFFF"))
            _set_theme_color(clr_scheme, "dk2", theme.get("secondaryColor", "#444444"))
            _set_theme_color(clr_scheme, "accent1", theme.get("accentColor", "#0078D4"))

        # Apply fonts via font scheme
        font_scheme = theme_elem.find(qn("a:fontScheme"))
        if font_scheme is None:
            font_scheme = master.element.find(
                ".//" + qn("a:fontScheme")
            )
        if font_scheme is not None:
            _set_font_scheme(font_scheme, "major", theme.get("fontTitle", "Arial"))
            _set_font_scheme(font_scheme, "minor", theme.get("fontBody", "Arial"))

    except Exception as e:
        logger.warning(f"Failed to apply theme: {e}")


def _set_theme_color(clr_scheme, name: str, hex_color: str) -> None:
    """Set an sRGB colour in a clrScheme element."""
    try:
        color_elem = clr_scheme.find(qn(f"a:{name}"))
        if color_elem is None:
            # Create it
            color_elem = parse_xml(
                f'<a:{name} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
                f'<a:srgbClr val="{hex_color.lstrip("#")}"/>'
                f"</a:{name}>"
            )
            clr_scheme.append(color_elem)
        else:
            # Update existing srgbClr
            srgb = color_elem.find(qn("a:srgbClr"))
            if srgb is not None:
                srgb.set("val", hex_color.lstrip("#"))
            else:
                # Remove any existing child and add srgbClr
                for child in list(color_elem):
                    color_elem.remove(child)
                srgb_xml = f'<a:srgbClr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" val="{hex_color.lstrip("#")}"/>'
                color_elem.append(parse_xml(srgb_xml))
    except Exception as e:
        logger.warning(f"Failed to set theme color {name}: {e}")


def _set_font_scheme(font_scheme, scheme: str, font_name: str) -> None:
    """Set the latin typeface in a majorFont/minorFont element."""
    try:
        font_elem = font_scheme.find(qn(f"a:{scheme}Font"))
        if font_elem is None:
            font_elem = parse_xml(
                f'<a:{scheme}Font xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
                f'<a:latin typeface="{font_name}"/>'
                f'<a:ea typeface="{font_name}"/>'
                f"</a:{scheme}Font>"
            )
            font_scheme.append(font_elem)
        else:
            latin = font_elem.find(qn("a:latin"))
            if latin is not None:
                latin.set("typeface", font_name)
            else:
                latin = parse_xml(
                    f'<a:latin xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" typeface="{font_name}"/>'
                )
                font_elem.append(latin)
    except Exception as e:
        logger.warning(f"Failed to set {scheme} font: {e}")


# ─── Background Application ────────────────────────────────────────────────────


def _apply_slide_background(slide, background: Dict[str, str]) -> None:
    """
    Set the background of a slide.

    Supports:
      - type: "color"  -> solid fill
      - type: "gradient"  -> gradient fill (approximated)
      - type: "image"  -> picture fill
    """
    bg_type = background.get("type", "color")
    value = background.get("value", "#FFFFFF")

    try:
        bg = slide.background
        fill = bg.fill

        if bg_type == "color":
            hex_val = value.lstrip("#")
            if re.match(r"^[0-9A-Fa-f]{6}$", hex_val):
                fill.solid()
                fill.fore_color.rgb = RGBColor(
                    int(hex_val[0:2], 16),
                    int(hex_val[2:4], 16),
                    int(hex_val[4:6], 16),
                )
            elif value.startswith("theme:"):
                # Theme-based color - set solid with a fallback
                fill.solid()
                fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

        elif bg_type == "gradient":
            _apply_gradient_background(slide, value)

        elif bg_type == "image":
            _apply_image_background(slide, value)

    except Exception as e:
        logger.warning(f"Failed to apply slide background: {e}")
        # Fallback: white background
        try:
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        except Exception:
            pass


def _apply_gradient_background(slide, grad_str: str) -> None:
    """
    Apply a gradient background by manipulating the XML directly.
    """
    try:
        bg = slide.background
        # Set the fill to gradient via XML
        bg_xml = bg._element
        # Remove existing fill
        for child in list(bg_xml):
            bg_xml.remove(child)

        # Parse gradient direction and stops from CSS-like string
        # Format: linear-gradient(135deg, #color1 pct%, #color2 pct%, ...)
        angle = 135
        stops = [("#000000", 0), ("#FFFFFF", 100)]

        css_match = re.match(
            r"linear-gradient\(\s*([^,]+)\s*,\s*(.*)\s*\)", grad_str
        )
        if css_match:
            dir_str = css_match.group(1).strip()
            stops_str = css_match.group(2)
            # Extract angle
            ang_match = re.match(r"(\d+)deg", dir_str)
            if ang_match:
                angle = int(ang_match.group(1))
            # Extract stops
            stop_matches = re.findall(
                r"(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})\s*([\d.]+)?%?",
                stops_str,
            )
            if stop_matches:
                stops = []
                for color, pos in stop_matches:
                    pct = float(pos) if pos else 0
                    stops.append((color, int(pct)))

        # Construct the gradient fill XML
        # EMU angle: 0 = right, 5400000 = down (90 deg), 10800000 = left (180 deg)
        # CSS angle 0deg = up, 90deg = right
        # Convert CSS deg to EMU: emu_angle = (5400000 - css_deg * 60000) % 21600000
        emu_angle = (5400000 - angle * 60000) % 21600000

        stops_xml = ""
        for i, (color, pos) in enumerate(stops):
            stops_xml += (
                f'<a:gs pos="{pos * 1000}">'
                f'<a:srgbClr val="{color.lstrip("#")}"/>'
                f"</a:gs>"
            )

        grad_xml = (
            f'<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            f'<a:lin ang="{emu_angle}" scaled="0"/>'
            f'<a:gsLst>{stops_xml}</a:gsLst>'
            f"</a:gradFill>"
        )
        bg_xml.append(parse_xml(grad_xml))
    except Exception as e:
        logger.warning(f"Failed to apply gradient background: {e}")
        # Fallback
        try:
            slide.background.fill.solid()
            slide.background.fill.fore_color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        except Exception:
            pass


def _apply_image_background(slide, value: str) -> None:
    """
    Apply an image as the slide background.
    Uses the XML approach for picture fills.
    """
    if not value:
        return

    try:
        image_data, content_type = _resolve_image_data(value)

        # Add image to slide's part relationships
        image_part = slide.part.get_or_add_image_part(
            image_blob=image_data,
            content_type=content_type or "image/png",
        )

        # Set the background fill via XML
        bg = slide.background
        bg_xml = bg._element
        # Remove existing children
        for child in list(bg_xml):
            bg_xml.remove(child)

        r_id = slide.part.relate_to(
            image_part,
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
        )

        fill_xml = (
            f'<a:blipFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            f'rotWithShape="0">'
            f'<a:blip r:embed="{r_id}" '
            f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
            f'<a:stretch><a:fillRect/></a:stretch>'
            f"</a:blipFill>"
        )
        bg_xml.append(parse_xml(fill_xml))
    except Exception as e:
        logger.warning(f"Failed to apply image background: {e}")


# ─── Element Rendering ────────────────────────────────────────────────────────


def _add_text_element(
    slide, element: Dict[str, Any], slide_width_emu: int, slide_height_emu: int
) -> None:
    """
    Add a TextElement to a slide as a text box.
    """
    x = pct_to_emu(element.get("x", 0), slide_width_emu)
    y = pct_to_emu(element.get("y", 0), slide_height_emu)
    w = pct_to_emu(element.get("width", 100), slide_width_emu)
    h = pct_to_emu(element.get("height", 10), slide_height_emu)

    # Ensure minimum dimensions
    w = max(w, Emu(100))
    h = max(h, Emu(100))

    txBox = slide.shapes.add_textbox(x, y, w, h)
    tf = txBox.text_frame
    tf.word_wrap = True

    content = element.get("content", "")
    font_size = element.get("fontSize", 18)
    font_family = element.get("fontFamily", "Arial")
    color = element.get("color", "#000000")
    bold = element.get("fontWeight", "normal") == "bold"
    italic = element.get("fontStyle", "normal") == "italic"
    text_align = element.get("textAlign", "left")
    line_height = element.get("lineHeight", 1.2)

    # Map alignment
    align_map = {
        "left": PP_ALIGN.LEFT,
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
    }
    alignment = align_map.get(text_align, PP_ALIGN.LEFT)

    # Handle multi-line content
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()

        p.alignment = alignment
        p.space_after = Pt(4)

        run = p.add_run()
        run.text = line
        run.font.size = Pt(font_size)
        run.font.name = font_family

        try:
            run.font.color.rgb = _hex_to_rgb(color)
        except Exception:
            pass

        run.font.bold = bold
        run.font.italic = italic


def _add_image_element(
    slide, element: Dict[str, Any], slide_width_emu: int, slide_height_emu: int
) -> None:
    """
    Add an ImageElement to a slide.

    Supports:
      - data: URIs (base64-encoded)
      - HTTP/HTTPS URLs (downloaded)
      - Local file paths
    """
    src = element.get("src", "")
    if not src:
        logger.warning("Image element has no src, skipping")
        return

    x = pct_to_emu(element.get("x", 0), slide_width_emu)
    y = pct_to_emu(element.get("y", 0), slide_height_emu)
    w = pct_to_emu(element.get("width", 50), slide_width_emu)
    h = pct_to_emu(element.get("height", 30), slide_height_emu)

    # Ensure minimum dimensions
    w = max(w, Emu(100))
    h = max(h, Emu(100))

    try:
        image_data, content_type = _resolve_image_data(src)
        image_stream = io.BytesIO(image_data)

        # python-pptx add_picture takes a file path or stream
        pic = slide.shapes.add_picture(image_stream, x, y, w, h)
    except Exception as e:
        logger.warning(f"Failed to add image to slide: {e}")
        # Fallback: add a placeholder rectangle
        shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, x, y, w, h
        )
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor(0xE0, 0xE0, 0xE0)
        tf = shape.text_frame
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        run = tf.paragraphs[0].add_run()
        run.text = "🖼"
        run.font.size = Pt(24)


def _add_shape_element(
    slide, element: Dict[str, Any], slide_width_emu: int, slide_height_emu: int
) -> None:
    """
    Add a ShapeElement to a slide.
    """
    x = pct_to_emu(element.get("x", 0), slide_width_emu)
    y = pct_to_emu(element.get("y", 0), slide_height_emu)
    w = pct_to_emu(element.get("width", 20), slide_width_emu)
    h = pct_to_emu(element.get("height", 20), slide_height_emu)

    # Ensure minimum dimensions
    w = max(w, Emu(100))
    h = max(h, Emu(100))

    shape_type_name = element.get("shape", "rectangle")
    fill_color = element.get("fill", "#CCCCCC")
    stroke_color = element.get("stroke")
    stroke_width = element.get("strokeWidth")

    # Map shape name to MSO_SHAPE
    shape_map = {
        "rectangle": MSO_SHAPE.RECTANGLE,
        "circle": MSO_SHAPE.OVAL,
        "ellipse": MSO_SHAPE.OVAL,
        "oval": MSO_SHAPE.OVAL,
        "triangle": MSO_SHAPE.ISOSCELES_TRIANGLE,
        "line": MSO_SHAPE.RECTANGLE,  # lines in pptx are tricky; use thin rect
    }
    mso_shape = shape_map.get(shape_type_name, MSO_SHAPE.RECTANGLE)

    try:
        shape = slide.shapes.add_shape(mso_shape, x, y, w, h)

        # Apply fill
        try:
            shape.fill.solid()
            shape.fill.fore_color.rgb = _hex_to_rgb(fill_color)
        except Exception:
            shape.fill.background()

        # Apply stroke / line
        if stroke_color:
            try:
                shape.line.color.rgb = _hex_to_rgb(stroke_color)
            except Exception:
                pass
        if stroke_width is not None:
            try:
                shape.line.width = Pt(stroke_width)
            except Exception:
                pass

        # Handle "line" shape type specially: make it a thin horizontal line
        if shape_type_name == "line":
            shape.height = Emu(12000)  # ~1 pt thick
            # Remove fill for lines
            try:
                shape.fill.background()
            except Exception:
                pass

    except Exception as e:
        logger.warning(f"Failed to add shape to slide: {e}")


# ─── Speaker Notes ────────────────────────────────────────────────────────────


def _set_speaker_notes(slide, notes: str) -> None:
    """Set the speaker notes for a slide."""
    if not notes:
        return
    try:
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes
    except Exception:
        pass


# ─── Main Build Entry Point ───────────────────────────────────────────────────


def build_pptx(presentation_data: Dict[str, Any], output_path: Optional[str] = None) -> bytes:
    """
    Build a .pptx file from a SlidePresentation JSON dict.

    Args:
        presentation_data: Dict matching the SlidePresentation TypeScript interface.
        output_path: Optional file path to write the .pptx to.
            If not provided, only returns bytes.

    Returns:
        Bytes of the .pptx file.
    """
    prs = Presentation()

    # Apply theme
    theme = presentation_data.get("theme", {})
    _apply_theme(prs, theme)

    # Store slide dimensions
    slide_width_emu = prs.slide_width or SLIDE_WIDTH_EMU
    slide_height_emu = prs.slide_height or SLIDE_HEIGHT_EMU

    # Process slides
    slides_data = presentation_data.get("slides", [])
    for slide_data in slides_data:
        # Add a blank slide (using the blank layout if available)
        layout = None
        try:
            # Try to get the blank layout
            for l in prs.slide_layouts:
                if l.name.lower() in ("blank", "empty", "custom"):
                    layout = l
                    break
            if layout is None and prs.slide_layouts:
                layout = prs.slide_layouts[0]  # Fallback to first layout
        except Exception:
            pass

        if layout:
            slide = prs.slides.add_slide(layout)
            # Remove all existing shapes from the layout for a clean slate
            try:
                for shape in list(slide.shapes):
                    sp = shape._element
                    sp.getparent().remove(sp)
            except Exception:
                pass
        else:
            # If no layouts available, add_slide won't work without a layout
            # This shouldn't happen with a valid template, but handle gracefully
            logger.warning("No slide layouts available")
            continue

        # Apply background
        background = slide_data.get("background", {})
        _apply_slide_background(slide, background)

        # Add elements
        elements = slide_data.get("elements", [])
        for element in elements:
            elem_type = element.get("type", "text")
            try:
                if elem_type == "text":
                    _add_text_element(
                        slide, element, slide_width_emu, slide_height_emu
                    )
                elif elem_type == "image":
                    _add_image_element(
                        slide, element, slide_width_emu, slide_height_emu
                    )
                elif elem_type == "shape":
                    _add_shape_element(
                        slide, element, slide_width_emu, slide_height_emu
                    )
            except Exception as e:
                logger.warning(
                    f"Failed to add {elem_type} element: {e}"
                )
                continue

        # Set speaker notes
        speaker_notes = slide_data.get("speakerNotes", "")
        _set_speaker_notes(slide, speaker_notes)

    # Save to bytes
    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    pptx_bytes = buf.getvalue()

    # Optionally write to file
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(pptx_bytes)
        logger.info(f"Saved .pptx to {output_path}")

    return pptx_bytes
