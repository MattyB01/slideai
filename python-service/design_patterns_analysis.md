================================================================================
  DESIGN PATTERN ANALYSIS — 10 PPTX SAMPLES
================================================================================

PARSER:       ~/slideai/python-service/parser.py
SAMPLES:      ~/slideai/public/samples/*.pptx
DATE:         June 2026
FILES:        10/10 parsed successfully


─── 1. COLOR SCHEMES & THEMES ───

All 10 files share the default Office theme in their a:clrScheme XML:
  Primary:   #0078D4  (DK1/black)
  Secondary: #106EBE  (DK2/dark gray)
  Accent:    #FFB900  (AC1/orange)
  BG Base:   #FFFFFF  (LT1/white)

However, each deck OVERRIDES theme colors at the per-slide level with
deliberately chosen background and element colors. The REAL design palettes:

  a) CORPORATE CLEAN (Performance_Review.pptx)
     White backgrounds throughout. Dark gray (#191919) rectangles for
     contrast. Black/blue text. Clean, restrained blue-tone palette.

  b) ENVIRONMENTAL ORGANIC (Nature_Journal.pptx)
     White bg with heavy image content. Nature imagery dominates.
     Minimal color interference — greens/browns come from photos.

  c) LUXURY ELEGANT (Luxury_Consulting.pptx)
     Dual-tone scheme: #255957 (deep teal) and #FEFAE0 (cream/warm white).
     Sophisticated, muted contrast. No bright accent colors — restrained
     and premium feel.

  d) MINIMAL PROFESSIONAL (Simple_Business_Proposal.pptx)
     Single tinted bg: #EAE8F3 (cool lavender-gray). Very subtle color
     presence. Content-driven, not decoration-driven.

  e) BOLD DRAMATIC (Bold_Product_Launch.pptx)
     Three saturated slide-level backgrounds:
     - #D90368 (magenta)
     - #258607 (vivid green)
     - #065BDA (deep blue)
     Maximum contrast, emotionally charged, high-impact.

  f) PLAYFUL COLORFUL (Fun_Run_Sunday.pptx)
     Four distinct backgrounds: #E55812 (burnt orange), #002626 (dark teal),
     #EFE7DA (warm cream), #95C623 (lime green). Energetic, varied,
     fun palette with no dominant color.

  g) WARM APPETIZING (Restaurant_Marketing.pptx)
     White and black bgs. Large black rectangles as framing devices.
     Warm food imagery provides color. Text uses scheme:tx1 (theme text).

  h) TECH FUTURISTIC (Future_Of_AI.pptx)
     White bgs with heavy black rectangular framing. 58 images (icons,
     diagrams, photos). Blue/white tech aesthetic from images.

  i) ACADEMIC FORMAL (Business_Math_Accounting.pptx)
     White bgs with black frame rectangles. Conservative, no-nonsense.
     Color comes from content (charts, tables, diagrams). Minimal
     decorative color.

  j) ENVIRONMENTAL NATURE (World_Environment_Day.pptx)
     White bgs but full-bleed nature images dominate (68% avg area).
     Green/blue earth tones from photography. Triangular decorative
     elements (67 triangles vs 51 rectangles — the only deck where
     triangles outnumber rectangles).


─── 2. BACKGROUND HANDLING ───

All 10 files use SOLID COLOR backgrounds exclusively (no gradients or
pattern fills detected at the parser level). The range:

  White-only:        Performance_Review, Nature_Journal, Future_Of_AI,
                     Business_Math_Accounting, World_Environment_Day,
                     Restaurant_Marketing
  Single tinted:     Simple_Business_Proposal (#EAE8F3)
  Dual-tone:         Luxury_Consulting (#255957 / #FEFAE0)
  Multi-color:       Bold_Product_Launch (3 saturated colors),
                     Fun_Run_Sunday (4 distinct colors)

KEY INSIGHT: The most visually interesting decks use per-SLIDE background
overrides rather than a single background. This is done by setting the
slide background fill directly rather than relying on the theme.


─── 3. LAYOUT PATTERNS ───

  ┌──────────────────────────────┬─────────┬────────┬──────────┬───────────┐
  │ File                        │ Slides  │ Avg    │ Title Y% │ Dominant  │
  │                             │         │ Elems  │          │ Zone      │
  ├──────────────────────────────┼─────────┼────────┼──────────┼───────────┤
  │ Performance_Review          │ 22      │ 11.4   │ 18.9%    │ top       │
  │ Nature_Journal              │ 15      │ 10.1   │ 15.2%    │ center    │
  │ Luxury_Consulting           │ 23      │ 10.3   │ 7.2%     │ center    │
  │ Simple_Business_Proposal    │ 17      │ 7.0    │ 13.2%    │ left      │
  │ Bold_Product_Launch         │ 17      │ 7.6    │ 3.5%     │ top       │
  │ Fun_Run_Sunday              │ 24      │ 7.0    │ 18.9%    │ top       │
  │ Restaurant_Marketing        │ 21      │ 70.5   │ 16.2%    │ middle    │
  │ Future_Of_AI                │ 19      │ 38.6   │ 14.3%    │ middle    │
  │ Business_Math_Accounting    │ 18      │ 78.1   │ 12.5%    │ middle    │
  │ World_Environment_Day       │ 36      │ 5.1    │ 22.7%    │ top       │
  └──────────────────────────────┴─────────┴────────┴──────────┴───────────┘

PATTERNS:
  - Titles consistently at 3-23% from top (strong top-anchoring)
  - Decks with heavy shape decoration (Restaurant, AI, Accounting) show
    70+ avg elements/slide — these are structured/templated decks with
    many framing rectangles
  - Image-heavy decks (Bold Launch, Nature Journal) have fewer elements
    (7-10) — letting images breathe
  - Minimal/professional decks (Simple_Business, Fun_Run) run ~7 avg
    elements — focused and uncluttered


─── 4. TYPOGRAPHY ───

All 10 files use Arial as both title and body font (from theme default).
Two distinct size regimes emerge:

  REGIME 1 (14pt): Corporate, Nature, Luxury, Simple, Bold, Fun_Run
    - Text-heavy, content-dense decks
    - Manual hierarchical size variation within paragraphs
    - Alignment diversity: center 54%, right 27%, left 19%

  REGIME 2 (28pt): Restaurant, Future_Of_AI, Accounting, World_Env
    - Larger, more visual/presentation-oriented decks
    - Less text overall, more visual communication
    - Right-alignment dominant (50%+)

KEY INSIGHT: The decks that feel "designed" vs "document-like" use
larger base font sizes and more alignment variety. The most
presentation-like decks (Bold Launch, Future_Of_AI) combine large
headings with sparse body text.


─── 5. DECORATIVE SHAPES ───

Shape usage is the strongest differentiator:

  ┌──────────────────────────────┬───────────┬──────────┬──────────┬─────────┐
  │ File                        │ Rectangles│ Triangles│ Circles  │ Total   │
  ├──────────────────────────────┼───────────┼──────────┼──────────┼─────────┤
  │ Performance_Review          │ 41        │ 0        │ 0        │ 41      │
  │ Nature_Journal              │ 82        │ 0        │ 0        │ 82      │
  │ Luxury_Consulting           │ 16        │ 0        │ 0        │ 16      │
  │ Simple_Business_Proposal    │ 18        │ 0        │ 0        │ 18      │
  │ Bold_Product_Launch         │ 23        │ 0        │ 0        │ 23      │
  │ Fun_Run_Sunday              │ 120       │ 0        │ 0        │ 120     │
  │ Restaurant_Marketing        │ 1379      │ 21       │ 5        │ 1405    │
  │ Future_Of_AI                │ 607       │ 31       │ 12       │ 650     │
  │ Business_Math_Accounting    │ 1366      │ 4        │ 2        │ 1372    │
  │ World_Environment_Day       │ 51        │ 67       │ 0        │ 118     │
  └──────────────────────────────┴───────────┴──────────┴──────────┴─────────┘

PATTERNS:
  - RECTANGLES are the universal design workhorse: used for content
    frames, backgrounds, table borders, image frames, decorative bars.
  - TRIANGLES appear in only 4 decks: World_Environment_Day (67 — more
    than its rectangles!), Future_Of_AI (31), Restaurant (21),
    Accounting (4). Triangles suggest arrows, peaks, mountains, direction.
  - CIRCLES are rare: only in Future_Of_AI (12 — tech/diagram nodes),
    Restaurant (5 — decorative bubbles), Accounting (2).
  - The #000000 (black) shape fill dominates in decks with high shape
    counts — used as border/frame rectangles.
  - Luxury_Consulting uses the FEWEST shapes (16) — elegance through
    restraint.
  - Fun_Run_Sunday uses shapes exclusively (120 rectangles, 0 images) —
    fully vector/illustrative approach.


─── 6. DISTINCTIVE DESIGN STYLES — SUMMARY ───

  ★ CORPORATE CLEAN (Performance_Review)
     DNA: White + dark gray rectangles + centered text
     Avg complexity: 11 elements/slide
     Design pattern: "Document deck" — text-forward with subtle framing
     Best for: Internal reviews, status reports, team meetings

  ★ ENVIRONMENTAL ORGANIC (Nature_Journal)
     DNA: Full-bleed images (88% avg coverage) + minimal text overlay
     Avg complexity: 10 elements/slide
     Design pattern: "Photo journal" — images do the talking
     Best for: Portfolios, travelogues, visual storytelling

  ★ LUXURY ELEGANT (Luxury_Consulting)
     DNA: Teal + cream palette, title at 7% from top (highest placement),
           minimal shapes (16 total), strong image presence (43% coverage)
     Avg complexity: 10 elements/slide
     Design pattern: "Premium brochure" — space is the luxury
     Best for: Client pitches, high-end consulting, brand decks

  ★ MINIMAL PROFESSIONAL (Simple_Business_Proposal)
     DNA: Lavender-gray tinted bg, 7 avg elements (lowest among text decks),
           left-side dominant layout, small images (14% coverage)
     Avg complexity: 7 elements/slide
     Design pattern: "Clean proposal" — content with breathing room
     Best for: Business proposals, pitch decks, startup presentations

  ★ BOLD DRAMATIC (Bold_Product_Launch)
     DNA: Saturated slide colors (magenta/green/blue), title at 3.5%
           (highest on page), most images per slide (2.4 avg), 46% image
           coverage — images dominate
     Avg complexity: 8 elements/slide
     Design pattern: "Impact deck" — emotion through color and scale
     Best for: Product launches, marketing campaigns, keynote events

  ★ PLAYFUL COLORFUL (Fun_Run_Sunday)
     DNA: Four distinct slide colors (orange/teal/cream/lime), 120
           rectangles but ZERO images — fully vector/illustrative,
           energetic palette, right-aligned text
     Avg complexity: 7 elements/slide
     Design pattern: "Illustrative fun" — shapes create the world
     Best for: Community events, youth programs, informal campaigns

  ★ WARM APPETIZING (Restaurant_Marketing)
     DNA: White/black bgs, 1379 black rectangles as framing (most
           shape-heavy deck), 21 triangles (chevrons/arrows), 5 circles,
           large 28pt font, warm food imagery
     Avg complexity: 71 elements/slide (!)
     Design pattern: "Structured template" — heavy framing creates
           consistent visual grid
     Best for: Marketing collateral, menu presentations, brand guidelines

  ★ TECH FUTURISTIC (Future_Of_AI)
     DNA: White bg + black framing, 58 images (most of any deck),
           triangles (31) and circles (12) for diagram nodes, tech
           diagrams and timelines, 28pt font
     Avg complexity: 39 elements/slide
     Design pattern: "Infographic deck" — structured visual explanations
     Best for: Tech presentations, roadmaps, educational content

  ★ ACADEMIC FORMAL (Business_Math_Accounting)
     DNA: White bg, 1366 black rectangles (table grid structure),
           4 triangles, 2 circles, 28pt font, dense structured layouts
     Avg complexity: 78 elements/slide (most dense)
     Design pattern: "Textbook layout" — information density prioritized
     Best for: Educational content, textbooks, training materials

  ★ ENVIRONMENTAL NATURE (World_Environment_Day)
     DNA: White bg + full-bleed nature photos (68% avg coverage),
           67 triangles (mountain/leaf shapes — MORE than rectangles),
           most slides of any deck (36), large 28pt font
     Avg complexity: 5 elements/slide (most minimal)
     Design pattern: "Photo-forward narrative" — let photography lead
     Best for: Environmental decks, non-profit reports, nature portfolios


─── 7. CROSS-CUTTING PATTERNS: WHAT MAKES GREAT DESIGN ───

  1. COLOR VARIANCE = EMOTIONAL IMPACT
     Decks with per-slide color changes (Bold Launch, Fun Run, Luxury)
     feel more designed than those with single-bg consistency.
     Even subtle shifts (Simple_Business's #EAE8F3) elevate perception.

  2. IMAGE SCALE DEFINES THE MODE
     - Full-bleed images (Nature: 88%, World_Env: 68%) → immersive,
       emotional, journalistic
     - Moderate images (Luxury: 43%, Bold: 46%) → premium, balanced
     - Small images (Simple: 14%) → supporting, document-like
     - No images (Fun Run: 0%) → fully illustrative/vector

  3. SHAPE USAGE IS A STYLE SIGNAL
     - Minimal shapes (<20) → luxury/elegant (Luxury: 16)
     - Moderate shapes (20-120) → corporate/professional
     - Heavy shapes (>600) → template-structured, grid-based design
     - Triangle > Rectangles → unique design signature (World_Env)

  4. TITLE PLACEMENT COMMUNICATES CONFIDENCE
     - High titles (3-7%) → bold, confident, image-led (Bold Launch,
       Luxury Consulting)
     - Mid titles (12-19%) → balanced, content-friendly (most decks)
     - Lower titles (22%+) → narrative-led, explanation-focused

  5. FONT SIZE SPLIT REVEALS TWO PHILOSOPHIES
     - 14pt regime → "reading deck" (documents you study)
     - 28pt regime → "presentation deck" (slides you show)
     Great decks match size to delivery medium.

  6. THE BEST DECKS HAVE A CLEAR GEOMETRIC SIGNATURE
     - Luxury: sparse shapes + premium colors → elegance
     - World_Env: triangles → nature/mountains
     - Future_Of_AI: circles+triangles → tech/diagrams
     - Fun_Run: purely rectangular vector art → illustrative
     - Bold: saturated color blocks → dramatic emphasis


─── FILES ───

Analysis script:   ~/slideai/python-service/analyze_design_patterns.py
Deep color dive:   ~/slideai/python-service/deep_color_analysis.py
Parser used:       ~/slideai/python-service/parser.py
Samples dir:       ~/slideai/public/samples/

================================================================================
  END OF ANALYSIS
================================================================================
