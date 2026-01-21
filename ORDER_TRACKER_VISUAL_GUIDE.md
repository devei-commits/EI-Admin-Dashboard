# Order Hub Orders Tracker - Visual Guide

## Dashboard Overview

The **Orders Tracker** is the primary dashboard for managing order progression through the 6-stage workflow.

### Header Section - Statistics

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│   Total     │  Stage   │  Stage   │  Stage   │  Stage   │  Stage   │  Stage   │
│   Orders    │    1     │    2     │    3     │    4     │    5     │    6     │
│             │          │          │          │          │          │          │
│     60      │    15    │    12    │     8    │     10   │     10   │     5    │
├─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│ Color: Blue Gradient    │ Amber Gradient │ Amber Gradient │ ... (for each stage)
└────────────────────────────────────────────────────────────────────────────────┘
```

### Search & Filter Bar

```
┌────────────────────────────────────────────────┬──────────────────┐
│ 🔍 Search: "SO-02907" / SKU / Item Name       │ Filter: Stage 1 ▼│
│ Placeholder: Search by Order No, SKU, Item... │                  │
└────────────────────────────────────────────────┴──────────────────┘
```

### Order Card Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SO-02907_1  🟦 NEW ORDER                          Stage 3/6           │
│  SKU: SK2201MC5R • Qty: 3000                  Connectivity Tracker      │
│  SK.MEN CORREXION SPOT RECTIFYING FACIAL SERUM FOR DARK SPOTS 30ML     │
│                                                                         │
│  Stage Progress:                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │  ✓   │ │  ✓   │ │  ⚙   │ │  ○   │ │  ○   │ │  ○   │               │
│  │(Comp)│ │(Comp)│ │(Curr)│ │(Pend)│ │(Pend)│ │(Pend)│               │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘               │
│   Emerald   Emerald   Blue    Gray    Gray     Gray                   │
│     1        2        3       4       5         6                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Order Date    │ Est. Delivery │ Unit Rate  │ Status              │  │
│  │ 2025-07-10    │ 2025-08-15    │ ₹45.50    │ UNDER REVIEW        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────┬──────────────────────────────────┐  │
│  │ Move to Stage 4              │ View Details                     │  │
│  └──────────────────────────────┴──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Color Scheme

**Stage Progress Colors:**
- 🟨 **Emerald/Green** (#10b981) = Completed (✓)
- 🔵 **Blue** (#3b82f6) = In Progress (⚙)
- ⚪ **Gray** (#e5e7eb) = Pending (○)

**Order Type Badges:**
- 🟢 **Green** = NEW ORDER
- 🔵 **Blue** = REORDER
- 🟠 **Orange** = MODIFIED

**Status Indicators:**
- 🟨 **Amber/Yellow** = Under Review
- 🟢 **Green** = Completed
- ⚪ **Gray** = Pending

## Workflow Progression Example

### Step 1: Order at Stage 1
```
SO-02907_1
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  ⚙   │ │  ○   │ │  ○   │ │  ○   │ │  ○   │ │  ○   │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
  Blue    Gray    Gray    Gray    Gray    Gray

Status: Orders Review (Stage 1/6)
Button: [Move to Stage 2]
```

### Step 2: User Clicks "Move to Stage 2"
```
Action: moveOrderToNextStage(order)
├── currentStage: 1 → 2
├── stageProgress[1]: 'in-progress' → 'completed'
├── stageProgress[2]: 'pending' → 'in-progress'
└── stage: 'ORDERS REVIEW' → 'PURCHASE PLAN'
```

### Step 3: Order at Stage 2 (After Progression)
```
SO-02907_1
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  ✓   │ │  ⚙   │ │  ○   │ │  ○   │ │  ○   │ │  ○   │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
Emerald   Blue    Gray    Gray    Gray    Gray

Status: Purchase Plan (Stage 2/6)
Button: [Move to Stage 3]
```

### Continued Progression
```
Stage 3 → ┌──────┐ ┌──────┐ ┌──────┐
          │  ✓   │ │  ✓   │ │  ⚙   │ ...
          └──────┘ └──────┘ └──────┘

Stage 4 → ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
          │  ✓   │ │  ✓   │ │  ✓   │ │  ⚙   │ ...
          └──────┘ └──────┘ └──────┘ └──────┘

... and so on until Stage 6
```

### Final Stage (Stage 6)
```
SO-02907_1
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  ✓   │ │  ✓   │ │  ✓   │ │  ✓   │ │  ✓   │ │  ⚙   │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
Emerald  Emerald  Emerald  Emerald  Emerald   Blue

Status: Order Closure (Stage 6/6)
Button: [Move to Closed Stage]
```

### Order Closed
```
SO-02907_1
All stages completed ✓
currentStage: 7 (Closed)
Status: ORDER CLOSED

Button: [View Details] (only - no progression button)
```

## Search & Filter Examples

### Example 1: Search by Order Number
```
Search Input: "SO-02907"
Results: 
├── SO-02907_1 (Stage 2) ✓
└── (showing 1 of 60 orders)
```

### Example 2: Filter by Stage
```
Filter Selected: Stage 3
Results:
├── SO-02961_1 (Connectivity Tracker)
├── SO-02968_2 (Connectivity Tracker)
├── SO-02975_1 (Connectivity Tracker)
└── (showing 8 of 60 orders in Stage 3)
```

### Example 3: Search by SKU
```
Search Input: "SK2201"
Results:
├── SO-02907_1 (Stage 2)
├── SO-02906_1 (Stage 1)
├── SO-02943_3 (Stage 4)
└── (showing 3 of 60 matching SKU)
```

## Multiple Orders View

### Dashboard with Multiple Orders
```
Statistics:
┌────────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Total  │  S1 │  S2 │  S3 │  S4 │  S5 │  S6 │
│  60    │ 15  │ 12  │  8  │ 10  │ 10  │  5  │
└────────┴─────┴─────┴─────┴─────┴─────┴─────┘

Cards Displayed:
┌─ SO-02907_1 (Stage 2) ────┐
│ Progress: [✓][⚙][○][○][○][○] │
│ [Move to Stage 3]          │
└────────────────────────────┘
┌─ SO-02906_1 (Stage 1) ────┐
│ Progress: [⚙][○][○][○][○][○] │
│ [Move to Stage 2]          │
└────────────────────────────┘
┌─ SO-02961_1 (Stage 3) ────┐
│ Progress: [✓][✓][⚙][○][○][○] │
│ [Move to Stage 4]          │
└────────────────────────────┘
... (60 orders total)
```

## Mobile Responsive Layout

### On Mobile Devices
```
┌──────────────────────┐
│ SO-02907_1           │
│ 🟦 NEW ORDER         │
│ SKU: SK2201MC5R      │
│ Stage 3/6            │
│                      │
│ [✓][✓][⚙][○][○][○]   │
│                      │
│ Order Date: 2025-... │
│ Status: UNDER REV... │
│                      │
│ [Move to Stage 4]    │
│ [View Details]       │
└──────────────────────┘
```

## UI Components Used

### Badges
- **Order Type**: `px-2.5 py-1 rounded-full text-xs font-medium`
- **Color Variations**: 
  - NEW ORDER: `bg-green-100 text-green-700`
  - REORDER: `bg-blue-100 text-blue-700`
  - MODIFIED: `bg-orange-100 text-orange-700`

### Buttons
- **Action Buttons**: 
  - Primary: `bg-amber-500 hover:bg-amber-600 text-white`
  - Secondary: `bg-gray-200 hover:bg-gray-300 text-gray-700`
- **Size**: `px-3 py-2 text-sm font-medium rounded-lg`

### Cards
- **Container**: `bg-white border border-gray-200 rounded-lg p-4`
- **Hover**: `hover:shadow-md transition-shadow`
- **Grid Layout**: Responsive columns with gap-3

### Progress Bar
- **Box Size**: `flex-1 h-8 rounded-md`
- **Icons**: Displayed in center with font-bold

## Keyboard Shortcuts (Future)

```
? = Show help
/ = Focus search
S = Sort by stage
F = Open filter
E = Export visible orders
→ = Next stage (on selected order)
← = Previous stage (on selected order)
Enter = Open selected order
```

---

## Key Features Summary

✅ **Real-time Statistics** - Live count per stage
✅ **Visual Progress** - 6-stage progress bars with icons
✅ **Color Coding** - Intuitive status colors
✅ **Search & Filter** - Quick order finding
✅ **Card Layout** - Clean, modern design
✅ **One-Click Progression** - Easy stage advancement
✅ **Responsive Design** - Works on all devices
✅ **Details Grid** - All key info at glance
✅ **Status Indicators** - Clear stage progression
✅ **Batch View** - See multiple orders simultaneously

---

**Last Updated**: December 2024
**Version**: 1.0
**Status**: Production Ready
