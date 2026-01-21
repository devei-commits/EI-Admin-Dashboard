# Order Hub Workflow System Guide

## Overview

The Order Hub implements a **6-Stage Sequential Order Workflow** with real-time tracking and status management. Every order progresses through defined stages, and the **Orders Tracker** provides a unified dashboard showing the current position of all orders in the pipeline.

## Workflow Stages

### Stage Flow
```
Stage 1: Orders Review
    ↓ (Complete & Click Action Button)
Stage 2: Purchase Plan
    ↓ (Complete & Click Action Button)
Stage 3: Connectivity Tracker
    ↓ (Complete & Click Action Button)
Stage 4: Production Planner
    ↓ (Complete & Click Action Button)
Stage 5: Production Tracker
    ↓ (Complete & Click Action Button)
Stage 6: Order Closure
    ↓ (Final Stage)
Order Closed
```

## Architecture

### Data Model

#### Order Interface
```typescript
interface Order {
  // ... existing fields
  currentStage: number;                    // 1-6 for stages, 7 for closed
  stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'>;
}
```

**Fields:**
- `currentStage`: Numeric value (1-6) representing which stage the order is currently in
- `stageProgress`: Object tracking the status of each stage
  - `'pending'`: Stage not started yet
  - `'in-progress'`: Stage is currently active
  - `'completed'`: Stage has been completed

### Stage Configuration

```typescript
const STAGES = [
  { id: 1, name: 'Orders Review', tabId: 'orders-review' },
  { id: 2, name: 'Purchase Plan', tabId: 'purchase-plan' },
  { id: 3, name: 'Connectivity Tracker', tabId: 'purchase-planner' },
  { id: 4, name: 'Production Planner', tabId: 'production-planner' },
  { id: 5, name: 'Production Tracker', tabId: 'production-tracker' },
  { id: 6, name: 'Order Closure', tabId: 'order-closure' },
];
```

### Helper Functions

#### `initializeOrderStages(orders: Order[]): Order[]`
Converts legacy stage string format to new numeric stage system.
- Maps stage strings to numeric values
- Initializes `stageProgress` based on current stage
- Called on initial data load

#### `moveOrderToNextStage(order: Order): Order`
Moves an order to the next sequential stage.
- Increments `currentStage` by 1
- Marks current stage as 'completed'
- Sets next stage to 'in-progress'
- Returns new order state for updating parent state

#### `getStageStatusColor(stageStatus): string`
Returns Tailwind CSS classes for stage progress styling.
- `'completed'`: emerald (green)
- `'in-progress'`: blue
- `'pending'`: gray

#### `getStageStatusIcon(stageStatus): string`
Returns visual indicator for stage status.
- `'completed'`: ✓
- `'in-progress'`: ⚙
- `'pending'`: ○

## Orders Tracker Dashboard

### Features

#### 1. Statistics Header
Shows count of orders in each stage:
- Total Orders count
- Orders in Stage 1, 2, 3, 4, 5, 6

#### 2. Search & Filter
- **Search**: Filter by Order No, SKU, or Item Name
- **Filter**: Show orders at specific stage or all stages

#### 3. Order Cards
Each order card displays:

**Header Section**
- Order Number and Type badge
- Item Name and SKU
- Current stage indicator (e.g., "Stage 3/6")
- Stage name (e.g., "Connectivity Tracker")

**Stage Progress Bar**
- Visual 6-box progress indicator
- Status icons: ○ (pending), ⚙ (in-progress), ✓ (completed)
- Color-coded boxes: gray, blue, emerald
- Hover shows stage names

**Details Grid**
- Order Date
- Est. Delivery Date
- Unit Rate
- Current Status

**Action Buttons**
- "Move to Stage X" button (if stage < 7)
- "View Details" button

### Interaction Flow

1. **Initial Load**: Orders loaded with stages initialized
2. **View Orders**: Orders Tracker shows all orders with progress
3. **Complete Work**: Team completes all work in current stage
4. **Move Forward**: Click "Move to Stage X" button
5. **Progress Update**: 
   - Current stage marked as 'completed'
   - Next stage marked as 'in-progress'
   - currentStage incremented
   - Orders Tracker updates automatically
6. **Final Stage**: Order reaches Stage 6 (Order Closure)
7. **Closed**: After Stage 6 completion, order moves to closed state (stage 7)

## Stage Tab Details

### Stage 1: Orders Review
**Purpose**: Initial review and validation of new orders
**Actions**:
- Review order specifications
- Check licenses and compliance
- Validate SKU and item details
- Action Button: "Complete & Move to Stage 2"

### Stage 2: Purchase Plan
**Purpose**: Plan purchase requirements and schedule
**Actions**:
- Create purchase plan
- Allocate resources
- Set timelines
- Action Button: "Complete & Move to Stage 3"

### Stage 3: Connectivity Tracker
**Purpose**: Track manufacturing connectivity and logistics
**Actions**:
- Link to manufacturing units
- Track transitions
- Manage location assignments
- Action Button: "Complete & Move to Stage 4"

### Stage 4: Production Planner
**Purpose**: Plan production scheduling and requirements
**Actions**:
- Schedule production
- Plan warehouse assignments
- Request raw materials/packaging
- Action Button: "Complete & Move to Stage 5"

### Stage 5: Production Tracker
**Purpose**: Monitor production execution
**Actions**:
- Track production progress
- Monitor filling/packaging
- Track tank codes
- Monitor delivery methods
- Action Button: "Complete & Move to Stage 6"

### Stage 6: Order Closure
**Purpose**: Final fulfillment and closure
**Actions**:
- Verify delivery completion
- Confirm order closure
- Archive records
- Final State: Order moves to "Closed"

## Using the Order Hub

### How to Progress an Order

1. **Navigate to Order Hub**
   - Click "Order Hub" in sidebar

2. **Find Your Order**
   - Search in Orders Tracker tab
   - Or click on specific stage tab

3. **Complete Stage Work**
   - Perform all required actions in current stage tab
   - Fill in required information
   - Update statuses/fields as needed

4. **Move to Next Stage**
   - Option A (Recommended): 
     - Go to Orders Tracker tab
     - Find the order
     - Click "Move to Stage X" button
   - Option B:
     - In stage tab, click action button
     - Confirms: "Complete & Move to Next Stage"

5. **Track Progress**
   - Orders Tracker shows all orders with current stage
   - Stage progress bar visualizes position
   - Color coding shows completion status

### Best Practices

1. **Complete Before Moving**: Ensure all stage requirements are complete before progressing
2. **Regular Updates**: Update order status regularly to keep tracker current
3. **Use Comments**: Add comments to orders for team communication
4. **Track Dates**: Keep estimated delivery dates updated
5. **Monitor Progress**: Check Orders Tracker regularly to see pipeline status

## Technical Implementation

### State Management

```typescript
const [orders, setOrders] = useState<Order[]>([]);

// Moving order to next stage:
const updatedOrder = moveOrderToNextStage(order);
setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
```

### Filtering Logic

```typescript
// Filter by search query
const matchesSearch = searchQuery === '' || 
  order.orderNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
  order.sku.toLowerCase().includes(searchQuery.toLowerCase());

// Filter by stage
const matchesStage = statusFilter === 'ALL' || 
  order.currentStage === parseInt(statusFilter);

// Combined filter
const filtered = orders.filter(o => matchesSearch && matchesStage);
```

### Persistence

**Current Implementation**: In-memory state with localStorage persistence in SalesAndPurchase component

**Future Enhancement**: 
- Implement backend API for order updates
- Add audit logging for stage transitions
- Add stage transition timestamps
- Implement concurrent user handling

## Future Enhancements

1. **Validation**: Add stage-specific validation before allowing progression
2. **Audit Trail**: Log who moved order to each stage and when
3. **Notifications**: Alert relevant teams when order reaches their stage
4. **SLA Tracking**: Monitor stage duration and alert if SLA exceeded
5. **Bulk Operations**: Move multiple orders between stages
6. **Workflow Templates**: Define stage-specific templates and requirements
7. **Stage Lock**: Prevent going back to previous stages
8. **Conditional Routing**: Route orders to different paths based on criteria

## Troubleshooting

### Order Not Moving to Next Stage
- Check that all required fields are filled
- Verify order hasn't already been closed
- Check browser console for JavaScript errors

### Orders Not Showing in Orders Tracker
- Verify orders are loaded in state
- Check search/filter criteria
- Clear browser cache and reload

### Stage Progress Not Updating
- Refresh page to sync state
- Check that moveOrderToNextStage function was called
- Verify order state updated in parent component

## Related Files

- **OrderHub.tsx**: Main component (2960+ lines)
- **SalesAndPurchase.tsx**: Related SO/PO status tracking
- **theme.ts**: Unified UI system colors and spacing
- **UnifiedComponents.tsx**: Reusable UI components

## API Reference

### STAGES Configuration
```typescript
STAGES: Array<{
  id: number;
  name: string;
  tabId: string;
}>
```

### Order Type
```typescript
interface Order {
  id: string;
  orderNo: string;
  orderType: 'NEW ORDER' | 'REORDER' | 'MODIFIED';
  currentStage: number;      // 1-6 (7 = closed)
  stageProgress: Record<number, 'pending' | 'in-progress' | 'completed'>;
  // ... other fields
}
```

### Helper Function Signatures
```typescript
initializeOrderStages(orders: Order[]): Order[]
moveOrderToNextStage(order: Order): Order
getStageStatusColor(status: 'pending' | 'in-progress' | 'completed'): string
getStageStatusIcon(status: 'pending' | 'in-progress' | 'completed'): string
```

---

**Last Updated**: December 2024
**Version**: 1.0
**Status**: Production Ready
