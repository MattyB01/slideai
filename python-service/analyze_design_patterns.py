"""
Analyze all 10 sample PPTX files for design patterns.
Extracts structured insights about color schemes, backgrounds, layout, typography,
decorative shapes, and distinct style characteristics.
"""
import sys
import os
import json
import re
from collections import defaultdict, Counter

# Add parser directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parser import parse_pptx, _extract_theme, _build_theme_color_map
from pptx import Presentation
from pptx.util import Emu


SAMPLE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "samples")

SAMPLE_FILES = [
    "Performance_Review.pptx",
    "Nature_Journal.pptx",
    "Luxury_Consulting.pptx",
    "Simple_Business_Proposal.pptx",
    "Bold_Product_Launch.pptx",
    "Fun_Run_Sunday.pptx",
    "Restaurant_Marketing.pptx",
    "Future_Of_AI.pptx",
    "Business_Math_Accounting.pptx",
    "World_Environment_Day.pptx",
]


def get_design_category(filename):
    """Infer the design style category from filename."""
    categories = {
        "Performance_Review": "corporate-clean",
        "Nature_Journal": "environmental-organic",
        "Luxury_Consulting": "luxury-elegant",
        "Simple_Business_Proposal": "minimal-professional",
        "Bold_Product_Launch": "bold-dramatic",
        "Fun_Run_Sunday": "playful-colorful",
        "Restaurant_Marketing": "warm-appetizing",
        "Future_Of_AI": "tech-futuristic",
        "Business_Math_Accounting": "academic-formal",
        "World_Environment_Day": "environmental-nature",
    }
    base = filename.replace(".pptx", "")
    return categories.get(base, "unknown")


def parse_backgrounds(result):
    """Analyze backgrounds across all slides."""
    bg_info = []
    for slide in result["slides"]:
        bg = slide["background"]
        bg_info.append({
            "index": slide["index"],
            "type": bg["type"],
            "value_preview": bg["value"][:80] + "..." if len(bg["value"]) > 80 else bg["value"],
        })
    return bg_info


def analyze_colors_across_presentation(result):
    """Extract and count all colors used in a presentation."""
    theme = result["theme"]
    colors = {
        "theme": theme,
        "background_colors": [],
        "text_colors": defaultdict(int),
        "shape_fill_colors": defaultdict(int),
        "all_hex_colors": defaultdict(int),
        "background_types": defaultdict(int),
    }
    
    for slide in result["slides"]:
        bg = slide["background"]
        colors["background_types"][bg["type"]] += 1
        if bg["type"] == "color":
            colors["background_colors"].append(bg["value"])
            colors["all_hex_colors"][bg["value"]] += 1
        elif bg["type"] == "gradient":
            # Extract colors from gradient
            grad_colors = re.findall(r'#[0-9A-Fa-f]{6}', bg["value"])
            for c in grad_colors:
                colors["all_hex_colors"][c] += 1
        
        for elem in slide["elements"]:
            if elem["type"] == "text":
                c = elem.get("color", "#000000")
                if c.startswith("#"):
                    colors["text_colors"][c] += 1
                    colors["all_hex_colors"][c] += 1
                bgc = elem.get("backgroundColor")
                if bgc and bgc.startswith("#"):
                    colors["shape_fill_colors"][bgc] += 1
                    colors["all_hex_colors"][bgc] += 1
            elif elem["type"] == "shape":
                c = elem.get("fill", "#CCCCCC")
                if c.startswith("#"):
                    colors["shape_fill_colors"][c] += 1
                    colors["all_hex_colors"][c] += 1
    
    return colors


def analyze_layout_patterns(result):
    """Analyze element positioning to identify layout patterns."""
    slide_size = {"width": 100.0, "height": 100.0}  # percentages
    layouts = []
    
    for slide in result["slides"]:
        text_elements = [e for e in slide["elements"] if e["type"] == "text"]
        shape_elements = [e for e in slide["elements"] if e["type"] == "shape"]
        image_elements = [e for e in slide["elements"] if e["type"] == "image"]
        
        # Find title-like elements (topmost text elements)
        title_elements = sorted(
            [e for e in text_elements if len(e.get("content", "").strip()) > 0],
            key=lambda e: e["y"]
        )[:2]
        
        # Find element density and zones
        zone_counts = {"top": 0, "middle": 0, "bottom": 0, "left": 0, "center": 0, "right": 0}
        for e in slide["elements"]:
            # Vertical zones
            if e["y"] < 33:
                zone_counts["top"] += 1
            elif e["y"] < 66:
                zone_counts["middle"] += 1
            else:
                zone_counts["bottom"] += 1
            # Horizontal zones
            center = e["x"] + e["width"] / 2
            if center < 33:
                zone_counts["left"] += 1
            elif center < 66:
                zone_counts["center"] += 1
            else:
                zone_counts["right"] += 1
        
        layouts.append({
            "index": slide["index"],
            "num_elements": len(slide["elements"]),
            "num_text": len(text_elements),
            "num_shapes": len(shape_elements),
            "num_images": len(image_elements),
            "title_y": title_elements[0]["y"] if title_elements else None,
            "zone_counts": zone_counts,
        })
    
    return layouts


def analyze_typography(result):
    """Extract typography details across all slides."""
    fonts_used = defaultdict(int)
    sizes_used = defaultdict(list)
    colors_used = defaultdict(int)
    alignments = defaultdict(int)
    font_families = set()
    
    for slide in result["slides"]:
        for elem in slide["elements"]:
            if elem["type"] == "text":
                content = elem.get("content", "").strip()
                if not content:
                    continue
                ff = elem.get("fontFamily", "Arial")
                fs = elem.get("fontSize", 14)
                color = elem.get("color", "#000000")
                align = elem.get("textAlign", "left")
                bold = elem.get("fontWeight", "normal")
                
                font_families.add(ff)
                fonts_used[ff] += 1
                sizes_used[fs].append(content[:40])
                colors_used[color] += 1
                alignments[align] += 1
    
    return {
        "font_families": sorted(font_families),
        "font_counts": dict(fonts_used),
        "size_samples": {k: v[:3] for k, v in sorted(sizes_used.items())},
        "color_counts": dict(sorted(colors_used.items(), key=lambda x: -x[1])),
        "alignment_counts": dict(alignments),
    }


def analyze_shapes(result):
    """Analyze decorative shape usage."""
    shape_types = defaultdict(int)
    shape_colors = defaultdict(int)
    
    for slide in result["slides"]:
        for elem in slide["elements"]:
            if elem["type"] == "shape":
                shape_types[elem["shape"]] += 1
                shape_colors[elem["fill"]] += 1
    
    return {
        "shape_type_counts": dict(shape_types),
        "shape_color_counts": dict(sorted(shape_colors.items(), key=lambda x: -x[1])),
    }


def analyze_image_usage(result):
    """Analyze image placement and sizing."""
    images = []
    for slide in result["slides"]:
        for elem in slide["elements"]:
            if elem["type"] == "image":
                images.append({
                    "slide": slide["index"],
                    "x": elem["x"],
                    "y": elem["y"],
                    "width": elem["width"],
                    "height": elem["height"],
                    "area_pct": round(elem["width"] * elem["height"] / 100.0, 1),
                    "alt": elem.get("alt", ""),
                })
    return images


def main():
    results = {}
    
    for fname in SAMPLE_FILES:
        path = os.path.join(SAMPLE_DIR, fname)
        if not os.path.exists(path):
            print(f"WARNING: {fname} not found at {path}")
            continue
        
        print(f"\n{'='*80}")
        print(f"PARSING: {fname}")
        print(f"{'='*80}")
        
        try:
            result = parse_pptx(path, embed_images=False)
            results[fname] = result
            
            category = get_design_category(fname)
            num_slides = len(result["slides"])
            num_elements = sum(len(s["elements"]) for s in result["slides"])
            num_images = sum(1 for s in result["slides"] for e in s["elements"] if e["type"] == "image")
            num_shapes = sum(1 for s in result["slides"] for e in s["elements"] if e["type"] == "shape")
            num_text = sum(1 for s in result["slides"] for e in s["elements"] if e["type"] == "text")
            
            print(f"  Category: {category}")
            print(f"  Slides: {num_slides}")
            print(f"  Total elements: {num_elements} (text={num_text}, shapes={num_shapes}, images={num_images})")
            print(f"  Theme: {json.dumps(result['theme'], indent=2)}")
            
        except Exception as e:
            print(f"  ERROR parsing {fname}: {e}")
            import traceback
            traceback.print_exc()
    
    # ─── Aggregated Analysis ─────────────────────────────────────
    print("\n\n")
    print("=" * 80)
    print("  AGGREGATED DESIGN PATTERN ANALYSIS")
    print("=" * 80)
    
    if not results:
        print("No files were parsed successfully.")
        return
    
    # Analyze each file in detail
    detailed = {}
    for fname, result in results.items():
        category = get_design_category(fname)
        detailed[fname] = {
            "category": category,
            "theme": result["theme"],
            "backgrounds": parse_backgrounds(result),
            "colors": analyze_colors_across_presentation(result),
            "layouts": analyze_layout_patterns(result),
            "typography": analyze_typography(result),
            "shapes": analyze_shapes(result),
            "images": analyze_image_usage(result),
            "slide_count": len(result["slides"]),
            "total_elements": sum(len(s["elements"]) for s in result["slides"]),
        }
    
    # ─── Print structured analysis per file ─────────────────────
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        cat = d["category"]
        print(f"\n{'─'*80}")
        print(f"  📁 {fname}  —  {cat}")
        print(f"{'─'*80}")
        
        # Theme / Color Scheme
        t = d["theme"]
        print(f"\n  🎨 COLOR SCHEME:")
        print(f"     Primary:   {t['primaryColor']}")
        print(f"     Secondary: {t['secondaryColor']}")
        print(f"     Accent:    {t['accentColor']}")
        print(f"     BG Base:   {t['backgroundColor']}")
        
        # Background types used
        bg_types = d["colors"]["background_types"]
        print(f"     BG Types:  {dict(bg_types)}")
        bg_colors = d["colors"]["background_colors"]
        unique_bg = list(set(bg_colors))
        if unique_bg:
            print(f"     BG Colors: {unique_bg}")
        
        # Typography
        ty = d["typography"]
        print(f"\n  🔤 TYPOGRAPHY:")
        print(f"     Title Font:  {t['fontTitle']}")
        print(f"     Body Font:   {t['fontBody']}")
        print(f"     Families:    {ty['font_families']}")
        if ty["size_samples"]:
            sizes = sorted(ty["size_samples"].keys())
            print(f"     Sizes (pt):  {sizes}")
        if ty["alignment_counts"]:
            print(f"     Alignments:  {ty['alignment_counts']}")
        
        # Layout patterns
        layouts = d["layouts"]
        avg_elements = sum(l["num_elements"] for l in layouts) / len(layouts)
        avg_shapes = sum(l["num_shapes"] for l in layouts) / len(layouts)
        avg_images = sum(l["num_images"] for l in layouts) / len(layouts)
        avg_text = sum(l["num_text"] for l in layouts) / len(layouts)
        
        # Determine typical title position
        title_ys = [l["title_y"] for l in layouts if l["title_y"] is not None]
        avg_title_y = sum(title_ys) / len(title_ys) if title_ys else None
        
        # Determine dominant zone
        zone_totals = defaultdict(int)
        for l in layouts:
            for zone, count in l["zone_counts"].items():
                zone_totals[zone] += count
        dominant_zones = sorted(zone_totals.items(), key=lambda x: -x[1])
        
        print(f"\n  📐 LAYOUT PATTERNS:")
        print(f"     Slides:        {d['slide_count']}")
        print(f"     Avg elements:  {avg_elements:.1f} (text={avg_text:.1f}, shapes={avg_shapes:.1f}, images={avg_images:.1f})")
        if avg_title_y is not None:
            print(f"     Avg title Y%:  {avg_title_y:.1f}%")
        print(f"     Dominant:      {dominant_zones[:4]}")
        
        # Shapes
        sh = d["shapes"]
        if sh["shape_type_counts"]:
            print(f"\n  ⬛ SHAPES:")
            for shtype, count in sh["shape_type_counts"].items():
                print(f"     {shtype}: {count}")
            top_colors = sorted(sh["shape_color_counts"].items(), key=lambda x: -x[1])[:5]
            if top_colors:
                print(f"     Top fills: {top_colors}")
        
        # Images
        imgs = d["images"]
        if imgs:
            print(f"\n  🖼️  IMAGES: {len(imgs)} total")
            avg_area = sum(i["area_pct"] for i in imgs) / len(imgs)
            print(f"     Avg area coverage: {avg_area:.1f}% of slide")
    
    # ─── Cross-file comparison ──────────────────────────────────
    print(f"\n\n{'='*80}")
    print(f"  CROSS-FILE COMPARISON & DESIGN PATTERN SUMMARY")
    print(f"{'='*80}")
    
    # Theme comparison
    print(f"\n─── THEME COLOR COMPARISON ───")
    print(f"{'File':<35} {'Primary':<10} {'Secondary':<10} {'Accent':<10} {'BG':<10} {'Title Font':<15} {'Body Font':<15}")
    print(f"{'─'*35} {'─'*10} {'─'*10} {'─'*10} {'─'*10} {'─'*15} {'─'*15}")
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        t = d["theme"]
        print(f"{fname:<35} {t['primaryColor']:<10} {t['secondaryColor']:<10} {t['accentColor']:<10} {t['backgroundColor']:<10} {t['fontTitle']:<15} {t['fontBody']:<15}")
    
    # Background type summary
    print(f"\n─── BACKGROUND TYPES ───")
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        bg_types = d["colors"]["background_types"]
        slides_str = ", ".join([f"#{b['index']}:{b['type']}" for b in d["backgrounds"]])
        print(f"  {fname:<35} {dict(bg_types)}  →  {slides_str}")
    
    # Shape usage summary
    print(f"\n─── SHAPE USAGE ───")
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        sh = d["shapes"]
        if sh["shape_type_counts"]:
            print(f"  {fname:<35} {sh['shape_type_counts']}")
    
    # Typography diversity
    print(f"\n─── FONT FAMILIES ───")
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        ty = d["typography"]
        print(f"  {fname:<35} Families: {ty['font_families']}  |  Sizes: {sorted(ty['size_samples'].keys())}")
    
    # ─── Design Pattern Insights ─────────────────────────────────
    print(f"\n\n{'='*80}")
    print(f"  🧠 DESIGN PATTERN INSIGHTS")
    print(f"{'='*80}\n")
    
    # Group by design category
    for fname in SAMPLE_FILES:
        if fname not in detailed:
            continue
        d = detailed[fname]
        cat = d["category"]
        t = d["theme"]
        
        print(f"\n  ★ {cat.upper()} ({fname})")
        
        # 1. Color Scheme
        print(f"     Colors: {t['primaryColor']} / {t['secondaryColor']} / {t['accentColor']} on {t['backgroundColor']}")
        
        # 2. Background approach
        bg_types = d["colors"]["background_types"]
        bg_type_str = ", ".join([f"{k}: {v} slides" for k, v in bg_types.items()])
        print(f"     Backgrounds: {bg_type_str}")
        
        # 3. Layout
        layouts = d["layouts"]
        avg_elements = sum(l["num_elements"] for l in layouts) / len(layouts)
        title_ys = [l["title_y"] for l in layouts if l["title_y"] is not None]
        avg_title_y = sum(title_ys) / len(title_ys) if title_ys else None
        title_pos = "top-aligned" if avg_title_y and avg_title_y < 20 else "centered" if avg_title_y and avg_title_y < 45 else "lower-third"
        print(f"     Layout: {avg_elements:.1f} avg elements/slide, title ~{avg_title_y:.0f}% ({title_pos})")
        
        # 4. Typography
        ty = d["typography"]
        font_str = f"{t['fontTitle']} (titles) / {t['fontBody']} (body)"
        sizes = sorted(ty["size_samples"].keys())
        size_range = f"{min(sizes)}-{max(sizes)}pt" if sizes else "N/A"
        print(f"     Fonts: {font_str}, sizes: {size_range}")
        
        # 5. Shapes
        sh = d["shapes"]
        if sh["shape_type_counts"]:
            shape_types_str = ", ".join([f"{k}: {v}" for k, v in sorted(sh["shape_type_counts"].items(), key=lambda x: -x[1])])
            print(f"     Decorative shapes: {shape_types_str}")
        
        # 6. What makes it distinct
        insights = []
        bg_types_list = list(bg_types.keys())
        if "gradient" in bg_types:
            insights.append("uses gradient backgrounds for depth")
        if "image" in bg_types:
            insights.append("uses image backgrounds for visual impact")
        if sh["shape_type_counts"].get("rectangle", 0) > 5:
            insights.append("heavy use of rectangles as decorative blocks")
        if sh["shape_type_counts"].get("circle", 0) > 0:
            insights.append("uses circular elements for visual interest")
        if d["images"]:
            insights.append(f"strategic image placement ({len(d['images'])} images)")
        if t["fontTitle"] != t["fontBody"]:
            insights.append("distinct title vs body fonts create hierarchy")
        print(f"     Distinctive: {'; '.join(insights) if insights else 'clean, minimal approach'}")
        
        # Design character summary
        design_notes = {
            "corporate-clean": "Professional, restrained palette with structured layouts. Great use of white space and consistent margins. Shapes used sparingly for emphasis.",
            "environmental-organic": "Nature-inspired greens and earth tones. Image-forward with organic color transitions. Gradient backgrounds for depth.",
            "luxury-elegant": "Dark, sophisticated palette (black/gold/navy). Minimal elements with high contrast. Typography-driven elegance.",
            "minimal-professional": "Simple two-color schemes. Maximum content density with clean structure. Text-focused with minimal decoration.",
            "bold-dramatic": "High contrast, large typography, saturated accent colors. Shapes used as dramatic backdrops. Big images for impact.",
            "playful-colorful": "Bright, saturated multi-color palettes. Irregular layouts, varied shapes. Energetic, informal feel.",
            "warm-appetizing": "Warm tones (reds, oranges, yellows). Food-focused imagery. Rounded friendly shapes.",
            "tech-futuristic": "Dark backgrounds with bright accent glows. Gradients suggest depth and technology. Sharp geometric shapes.",
            "academic-formal": "Conservative blues and grays. Dense text with clear hierarchical structure. Tables and diagrams.",
            "environmental-nature": "Earthy greens, browns, and blues. Nature imagery prominent. Organic shapes and flowing layouts.",
        }
        note = design_notes.get(cat, "")
        if note:
            print(f"     Character: {note}")
    
    print(f"\n{'='*80}")
    print(f"  ANALYSIS COMPLETE — {len(results)}/{len(SAMPLE_FILES)} files parsed successfully")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
