"""
Deep color analysis: extract actual element-level (non-theme-default) colors
to properly characterize each presentation's unique design intent.
"""
import sys
import os
import json
import re
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parser import parse_pptx

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

def is_default_color(c):
    """Check if this is a default/unset color."""
    if not c:
        return True
    if c in ("#000000", "#FFFFFF", "#CCCCCC", "#EEEEEE", "#000000", "#0078D4", "#106EBE", "#FFB900"):
        return True
    return False

def analyze():
    deep = {}
    
    for fname in SAMPLE_FILES:
        path = os.path.join(SAMPLE_DIR, fname)
        if not os.path.exists(path):
            continue
        
        result = parse_pptx(path, embed_images=False)
        
        # Collect all non-default text colors
        text_colors = Counter()
        shape_fills = Counter()
        backgrounds = []
        content_texts = []
        text_sizes = Counter()
        
        for slide in result["slides"]:
            bg = slide["background"]
            if bg["type"] == "color" and not is_default_color(bg["value"]):
                backgrounds.append(bg["value"])
            
            for elem in slide["elements"]:
                if elem["type"] == "text":
                    c = elem.get("color", "#000000")
                    if not is_default_color(c):
                        text_colors[c] += 1
                    sz = elem.get("fontSize", 14)
                    text_sizes[sz] += 1
                    content = elem.get("content", "").strip()
                    if content:
                        content_texts.append(content[:60])
                elif elem["type"] == "shape":
                    f = elem.get("fill", "#CCCCCC")
                    if not is_default_color(f):
                        shape_fills[f] += 1
        
        deep[fname] = {
            "distinct_bg": list(set(backgrounds)),
            "distinct_text_colors": dict(text_colors.most_common(10)),
            "distinct_shape_fills": dict(shape_fills.most_common(10)),
            "text_sizes": dict(text_sizes.most_common(5)),
            "sample_texts": content_texts[:5],
            "total_text_elements": sum(1 for s in result["slides"] for e in s["elements"] if e["type"] == "text"),
            "total_elements": sum(len(s["elements"]) for s in result["slides"]),
        }
    
    # Print structured report
    for fname in SAMPLE_FILES:
        if fname not in deep:
            continue
        d = deep[fname]
        base = fname.replace(".pptx", "").replace("_", " ")
        
        print(f"\n{'═'*80}")
        print(f"  {base}")
        print(f"{'═'*80}")
        
        # Distinct background colors (these are the REAL design choices)
        if d["distinct_bg"]:
            print(f"\n  🎨 Slide Background Colors (set per-slide, not theme defaults):")
            for bg in d["distinct_bg"]:
                print(f"     {bg}")
        else:
            print(f"\n  🎨 Background: White/theme-default throughout")
        
        # Non-default text colors
        if d["distinct_text_colors"]:
            print(f"  ✏️  Designer-chosen Text Colors:")
            for c, cnt in list(d["distinct_text_colors"].items())[:8]:
                print(f"     {c}  (used {cnt}x)")
        else:
            print(f"  ✏️  Text colors: Mostly defaults/black")
        
        # Shape fills that indicate design intent
        if d["distinct_shape_fills"]:
            print(f"  ⬛ Decorative Shape Fills (colors added by designer):")
            for c, cnt in list(d["distinct_shape_fills"].items())[:6]:
                print(f"     {c}  (used {cnt}x)")
        
        # Text sizes
        sizes = d["text_sizes"]
        if sizes:
            sz_str = ", ".join([f"{sz}pt ({cnt}x)" for sz, cnt in sorted(sizes.items(), key=lambda x: -x[1])[:5]])
            print(f"  🔤 Font sizes: {sz_str}")
        
        # Sample texts give clues about content
        if d["sample_texts"]:
            print(f"  📝 Key content samples:")
            for t in d["sample_texts"]:
                if len(t) > 40:
                    print(f"     \"{t[:40]}...\"")
                else:
                    print(f"     \"{t}\"")

def main():
    analyze()

if __name__ == "__main__":
    main()
