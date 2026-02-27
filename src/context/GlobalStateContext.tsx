import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Define complex types to mimic the v15f HTML structure loosely
export type GlobalState = any; // Will use 'any' initially to port the direct JS object easily. We can refine types later.
export type GlobalAction =
    | { type: 'SET_STATE'; payload: GlobalState }
    | { type: 'ADD_CUSTOMER_PO'; payload: any }
    | { type: 'UPDATE_PO_STATUS'; payload: { poId: string, status: string } }
    | { type: 'UPDATE_CUSTOMER_PO'; payload: { poId: string, updatedFields: any } }
    | { type: 'ADD_SALES_ORDER'; payload: any }
    | { type: 'UPDATE_ITEM_STOCK'; payload: { itemId: string, field: string, value: number } }
    | { type: 'ADD_PO'; payload: { stage: 'planned' | 'drafts' | 'treasury' | 'issued', po: any } }
    | { type: 'MOVE_PO_STAGE'; payload: { poId: string, from: string, to: string } }
    | { type: 'COMPLETE_GRN'; payload: { poId: string, lineItemId: string, grnData: any } }
    // v15f business logic actions
    | { type: 'CREATE_SO_FROM_CPO'; payload: { cpoId: string; soData: any; orderedProduct: any } }
    | { type: 'ADD_ORDERED_PRODUCT'; payload: any }
    | { type: 'ADD_PLANNED_LINE'; payload: { line: any; itemId: string; qty: number } }
    | { type: 'MOVE_PLANNED_TO_DRAFT'; payload: { vendor: string; draftPO: any; plannedLineIds: string[] } }
    | { type: 'ADD_TREASURY_REQUEST'; payload: any }
    | { type: 'ISSUE_PO_FROM_TREASURY'; payload: { poId: string; itemUpdates: { itemId: string; inTransitDelta: number }[] } }
    | { type: 'CREATE_BMR_BATCH'; payload: { batch: any; bmr: any; bpr?: any } }
    | { type: 'ADVANCE_BMR_STAGE'; payload: { bmrId: string; newStage: number } }
    | { type: 'ADVANCE_BPR_STAGE'; payload: { bprId: string; newStage: number } }
    | { type: 'COMPLETE_BPR_QC'; payload: { bprId: string; bmrId: string } }
    | { type: 'ADD_MATERIAL_REQUEST'; payload: any }
    | { type: 'SPLIT_DRAFT_PO'; payload: { draftId: string; newDrafts: any[] } }
    | { type: 'RELEASE_DRAFT_PO'; payload: { draftId: string } }
    | { type: 'MARK_TREASURY_PAID'; payload: { reqId: string } }
    | { type: 'CONFIRM_PO'; payload: { poId: string; confAt: string } }
    | { type: 'DISPATCH_PO'; payload: { poId: string } }
    ;

const initialState: GlobalState = {
    masters: {
        clients: [
            { id: "CL-001", name: "Akash Trading", city: "Bengaluru", segment: "D2C", terms: "Credit 15 days" },
            { id: "CL-002", name: "DermaCare Clinic", city: "Hyderabad", segment: "Dermatologist", terms: "Advance 100%" }
        ],
        vendors: [
            { id: "VN-001", name: "Aurochem", category: "Actives & Extracts", defaultTerms: "50% Advance, 50% on delivery", contact: "purchase@aurochem.in" },
            { id: "VN-002", name: "Sami Labs", category: "Actives", defaultTerms: "No advance, Net 15", contact: "sales@samilabs.in" },
            { id: "VN-003", name: "Essel Propack", category: "Tubes", defaultTerms: "30% Advance, 70% before dispatch", contact: "ops@essel.com" },
            { id: "VN-004", name: "Pragati Labels", category: "Labels", defaultTerms: "No advance, Net 30", contact: "orders@pragati.in" }
        ],
        paymentTerms: [
            { id: "PT-ADV50", name: "50% Advance, 50% on delivery", advancePct: 50, onDispatchPct: 0, onDeliveryPct: 50 },
            { id: "PT-ADV30", name: "30% Advance, 70% before dispatch", advancePct: 30, onDispatchPct: 70, onDeliveryPct: 0 },
            { id: "PT-NOADV15", name: "No advance, Net 15", advancePct: 0, onDispatchPct: 0, onDeliveryPct: 0 },
            { id: "PT-NOADV30", name: "No advance, Net 30", advancePct: 0, onDispatchPct: 0, onDeliveryPct: 0 }
        ]
    },
    items: [
        {
            id: "RM-AC-001", name: "Niacinamide", type: "RM", category: "Active", uom: "kg",
            spec: "Assay ≥ 99%, USP/EP grade, White crystalline powder",
            stock: 160, reserved: 110, poQty: 140, inTransit: 60,
            warehouses: [{ name: "WH-1 (Main)", qty: 90 }, { name: "WH-2 (Cold)", qty: 70 }],
            reservations: {
                rmBMR: [
                    { doc: "BMR-24081", order: "SO-03074", batch: "BULK-03074-01", qty: 35, status: "Released" },
                    { doc: "BMR-24092", order: "SO-03081", batch: "BULK-03081-01", qty: 25, status: "Draft" },
                    { doc: "BMR-24110", order: "SO-03088", batch: "BULK-03088-02", qty: 50, status: "Approved" }
                ], pmBPR: []
            },
            orders: [
                { order: "SO-03074", product: "Anti-Acne Facewash 100g", required: 60, planning: 92, pendingBlocker: true },
                { order: "SO-03081", product: "Oil Control Gel 50g", required: 40, planning: 78, pendingBlocker: false },
                { order: "SO-03088", product: "Sunscreen Gel SPF50 50g", required: 80, planning: 88, pendingBlocker: true },
                { order: "SO-03093", product: "Serum 30ml", required: 100, planning: 65, pendingBlocker: false }
            ],
            vendors: [
                { vendor: "Sami Labs", slabs: [{ moq: 25, price: 860, leadDays: 10 }, { moq: 50, price: 820, leadDays: 12 }, { moq: 100, price: 790, leadDays: 14 }] },
                { vendor: "Aurochem", slabs: [{ moq: 25, price: 875, leadDays: 9 }, { moq: 50, price: 835, leadDays: 11 }, { moq: 100, price: 800, leadDays: 13 }] }
            ],
            purchaseHistory: [
                { date: "2024-12-20", vendor: "Aurochem", qty: 50, unit: 830 },
                { date: "2024-10-15", vendor: "Sami Labs", qty: 100, unit: 795 }
            ]
        },
        {
            id: "RM-BS-014", name: "Aqua Oat Extract", type: "RM", category: "Active", uom: "kg",
            spec: "Beta-glucan ≥ 1.2%, glycerin base, light amber liquid",
            stock: 420, reserved: 260, poQty: 120, inTransit: 40,
            warehouses: [{ name: "WH-1 (Main)", qty: 300 }, { name: "WH-3 (Flammable)", qty: 120 }],
            reservations: { rmBMR: [{ doc: "BMR-24077", order: "SO-03070", batch: "BULK-03070-01", qty: 120, status: "Released" }, { doc: "BMR-24095", order: "SO-03082", batch: "BULK-03082-01", qty: 140, status: "Approved" }], pmBPR: [] },
            orders: [
                { order: "SO-03070", product: "Aqua Oat Cream 100g", required: 220, planning: 96, pendingBlocker: false },
                { order: "SO-03082", product: "Aqua Oat Lotion 200ml", required: 200, planning: 82, pendingBlocker: false },
                { order: "SO-03091", product: "Soothing Gel 50g", required: 100, planning: 60, pendingBlocker: false }
            ],
            vendors: [
                { vendor: "Aurochem", slabs: [{ moq: 100, price: 420, leadDays: 9 }, { moq: 200, price: 395, leadDays: 11 }, { moq: 500, price: 372, leadDays: 14 }] }
            ],
            purchaseHistory: [
                { date: "2025-01-15", vendor: "Aurochem", qty: 200, unit: 398 }
            ]
        },
        {
            id: "PM-TP-100", name: "Tube 100g (Laminated)", type: "PM", category: "TPM", uom: "pcs",
            spec: "Dia 35mm, flip-top cap, matt white, direct print compatible",
            stock: 12000, reserved: 9500, poQty: 15000, inTransit: 8000,
            warehouses: [{ name: "WH-PM-1", qty: 7000 }, { name: "WH-PM-2", qty: 5000 }],
            reservations: { rmBMR: [], pmBPR: [{ doc: "BPR-11021", order: "SO-03074", batch: "FG-03074-01", qty: 7000, status: "Approved" }, { doc: "BPR-11025", order: "SO-03079", batch: "FG-03079-01", qty: 2500, status: "Draft" }] },
            orders: [
                { order: "SO-03074", product: "Anti-Acne Facewash 100g", required: 14000, planning: 90, pendingBlocker: true },
                { order: "SO-03079", product: "Anti-Itch Lotion 100g", required: 4000, planning: 85, pendingBlocker: true },
                { order: "SO-03086", product: "Moisturizing Cream 100g", required: 3000, planning: 72, pendingBlocker: false }
            ],
            vendors: [
                { vendor: "Essel Propack", slabs: [{ moq: 5000, price: 6.8, leadDays: 18 }, { moq: 10000, price: 6.1, leadDays: 22 }, { moq: 20000, price: 5.7, leadDays: 26 }] }
            ],
            purchaseHistory: [
                { date: "2025-02-02", vendor: "Essel Propack", qty: 10000, unit: 6.1 }
            ]
        },
        {
            id: "PM-LB-050", name: "Label 50g (BOPP)", type: "PM", category: "SPM", uom: "pcs",
            spec: "BOPP matte, 60 micron, adhesive: acrylic, roll core 76mm",
            stock: 21000, reserved: 12000, poQty: 0, inTransit: 0,
            warehouses: [{ name: "WH-PM-1", qty: 14000 }, { name: "WH-PM-2", qty: 7000 }],
            reservations: { rmBMR: [], pmBPR: [{ doc: "BPR-11030", order: "SO-03088", batch: "FG-03088-01", qty: 8000, status: "Approved" }] },
            orders: [
                { order: "SO-03088", product: "Sunscreen Gel SPF50 50g", required: 8000, planning: 90, pendingBlocker: false },
                { order: "SO-03090", product: "Sunscreen Gel SPF30 50g", required: 5000, planning: 75, pendingBlocker: false }
            ],
            vendors: [
                { vendor: "Pragati Labels", slabs: [{ moq: 5000, price: 1.55, leadDays: 8 }, { moq: 10000, price: 1.30, leadDays: 11 }, { moq: 20000, price: 1.15, leadDays: 13 }] }
            ],
            purchaseHistory: [{ date: "2025-01-05", vendor: "Pragati Labels", qty: 10000, unit: 1.28 }]
        }
    ],
    orders: {
        customerPOs: [
            {
                po: "CPO-1187", poSeq: 1187,
                clientId: "CL-001", client: "Akash Trading",
                source: "customer",
                createdAt: "2025-02-20", receivedAt: "2025-02-20",
                value: 420000, termsId: "PT-ADV50",
                advancePct: 50, advanceAmt: 210000,
                status: "so_created",
                soRef: "SO-03074",
                payments: [
                    { type: "advance", pct: 50, amt: 210000, due: "2025-02-21", paid: true, paidOn: "2025-02-21", ref: "UTR-882211" },
                ],
                products: [
                    { product: "Anti-Acne Facewash 100g", sku: "100g Tube", qty: 14000, unitPrice: 30, lineValue: 420000 }
                ],
                notes: "Relaunch order — acne range",
                timeline: [
                    { stage: "PO Received", date: "2025-02-20", done: true },
                    { stage: "Finance Review", date: "2025-02-20", done: true },
                    { stage: "Advance Requested", date: "2025-02-21", done: true },
                    { stage: "Advance Paid", date: "2025-02-21", done: true },
                    { stage: "SO Created", date: "2025-02-22", done: true },
                    { stage: "Balance Payment", date: null, done: false },
                    { stage: "Dispatched", date: null, done: false },
                ]
            },
            {
                po: "CPO-1191", poSeq: 1191,
                clientId: "CL-002", client: "DermaCare Clinic",
                source: "customer",
                createdAt: "2025-02-23", receivedAt: "2025-02-23",
                value: 210000, termsId: "PT-ADV50",
                advancePct: 50, advanceAmt: 105000,
                status: "payment_pending",
                soRef: null,
                payments: [
                    { type: "advance", pct: 50, amt: 105000, due: "2025-02-27", paid: false, paidOn: null, ref: null },
                ],
                products: [
                    { product: "Sunscreen Gel SPF50 50g", sku: "50g Tube", qty: 8000, unitPrice: 26.25, lineValue: 210000 }
                ],
                notes: "Urgent reorder — derma clinic"
            },
            {
                po: "CPO-1195", poSeq: 1195,
                clientId: "CL-001", client: "Akash Trading",
                source: "bd_team",
                bdRep: "Priya S.",
                createdAt: "2025-02-24", receivedAt: null,
                value: 185000, termsId: "PT-ADV30",
                advancePct: 30, advanceAmt: 55500,
                status: "customer_approval_pending",
                soRef: null,
                payments: [],
                products: [
                    { product: "Anti-Itch Lotion 100g", sku: "100g Tube", qty: 5000, unitPrice: 37, lineValue: 185000 }
                ],
                notes: "Suggested reorder by BD — Priya S. created on behalf of client"
            },
            {
                po: "CPO-1196", poSeq: 1196,
                clientId: "CL-002", client: "DermaCare Clinic",
                source: "bd_team",
                bdRep: "Rajan M.",
                createdAt: "2025-02-25", receivedAt: null,
                value: 96000, termsId: "PT-NOADV15",
                advancePct: 0, advanceAmt: 0,
                status: "draft",
                soRef: null,
                payments: [],
                products: [
                    { product: "Sunscreen Gel SPF50 50g", sku: "50g Tube", qty: 4000, unitPrice: 24, lineValue: 96000 }
                ],
                notes: "New upsell opportunity — summer season"
            }
        ],
        salesOrders: [
            {
                so: "SO-03074", client: "CL-001", clientName: "Akash Trading", poRef: "CPO-1187",
                units: 14000, due: "2025-03-09", createdAt: "2025-02-20",
                internalStatus: "Batch created",
                customerStatus: "In production",
                planning: 88, splitBatches: 2,
                notes: "Priority order — acne range relaunch"
            },
            {
                so: "SO-03079", client: "CL-001", clientName: "Akash Trading", poRef: "CPO-1187",
                units: 4000, due: "2025-03-15", createdAt: "2025-02-22",
                internalStatus: "Approved",
                customerStatus: "Confirmed",
                planning: 82, splitBatches: 1,
                notes: "Anti-itch lotion — new SKU"
            },
            {
                so: "SO-03088", client: "CL-002", clientName: "DermaCare Clinic", poRef: "CPO-1191",
                units: 8000, due: "2025-03-06", createdAt: "2025-02-18",
                internalStatus: "BMR active",
                customerStatus: "In production",
                planning: 90, splitBatches: 1,
                notes: "Urgent — derma clinic reorder"
            }
        ],
        orderedProducts: [
            { id: "OP-001", so: "SO-03074", client: "Akash Trading", product: "Anti-Acne Facewash 100g", sku: "100g Tube", qty: 14000, orderDate: "2025-02-20", deliveryDate: "2025-03-09", stage: "Batch setup" },
            { id: "OP-002", so: "SO-03079", client: "Akash Trading", product: "Anti-Itch Lotion 100g", sku: "100g Tube", qty: 4000, orderDate: "2025-02-22", deliveryDate: "2025-03-15", stage: "Artwork review" },
            { id: "OP-003", so: "SO-03088", client: "DermaCare Clinic", product: "Sunscreen Gel SPF50 50g", sku: "50g Tube", qty: 8000, orderDate: "2025-02-18", deliveryDate: "2025-03-06", stage: "In manufacturing" }
        ],
        itemsInvolved: [
            { itemId: "RM-AC-001", itemName: "Niacinamide", uom: "kg", required: 280 },
            { itemId: "RM-BS-014", itemName: "Aqua Oat Extract", uom: "kg", required: 520 },
            { itemId: "PM-TP-100", itemName: "Tube 100g (Laminated)", uom: "pcs", required: 21000 },
            { itemId: "PM-LB-050", itemName: "Label 50g (BOPP)", uom: "pcs", required: 18000 }
        ]
    },
    po: {
        planned: [],
        drafts: [],
        treasury: [],
        issued: [
            {
                id: "PO-250021", vendor: "Aurochem", vendorId: "VN-001",
                status: "ISSUED", issuedAt: "2025-02-19",
                confirmation: "Confirmed", confAt: "2025-02-20",
                expectedConnectivity: "2025-02-24",
                expectedDelivery: "2025-03-02",
                expectedStockUpdate: "2025-03-03",
                dispatchStatus: "In transit",
                delayed: false, delayedTo: null,
                termsId: "PT-ADV50",
                notes: "Courier: BlueDart · LR pending",
                lines: [
                    { itemId: "RM-AC-001", itemName: "Niacinamide", uom: "kg", qty: 50, unit: 835, moq: 50, leadDays: 11, grn: { status: "Pending", validations: null, labels: [] } },
                    { itemId: "RM-BS-014", itemName: "Aqua Oat Extract", uom: "kg", qty: 200, unit: 398, moq: 200, leadDays: 11, grn: { status: "Pending", validations: null, labels: [] } }
                ]
            },
            {
                id: "PO-250022", vendor: "Essel Propack", vendorId: "VN-003",
                status: "ISSUED", issuedAt: "2025-02-23",
                confirmation: "Pending", confAt: null,
                expectedConnectivity: "2025-03-07",
                expectedDelivery: "2025-03-15",
                expectedStockUpdate: "2025-03-16",
                dispatchStatus: "Not dispatched",
                delayed: false, delayedTo: null,
                termsId: "PT-ADV30",
                notes: "Artwork: direct print · shade match pending",
                lines: [
                    { itemId: "PM-TP-100", itemName: "Tube 100g (Laminated)", uom: "pcs", qty: 10000, unit: 6.1, moq: 10000, leadDays: 22, grn: { status: "Pending", validations: null, labels: [] } }
                ]
            }
        ],
        seq: { po: 250023 }
    },
    mfg: {
        batches: [],
        bmrs: [],
        bprs: [],
        materialRequests: [],
        seq: { batch: 1, bmr: 1001, bpr: 2001 }
    }
};

const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
    switch (action.type) {
        case 'SET_STATE':
            return { ...state, ...action.payload };
        case 'ADD_CUSTOMER_PO':
            return {
                ...state,
                orders: { ...state.orders, customerPOs: [action.payload, ...state.orders.customerPOs] }
            };
        case 'UPDATE_PO_STATUS':
            return {
                ...state,
                orders: {
                    ...state.orders,
                    customerPOs: state.orders.customerPOs.map((po: any) =>
                        po.po === action.payload.poId ? { ...po, status: action.payload.status } : po
                    ),
                },
            };
        case 'UPDATE_CUSTOMER_PO':
            return {
                ...state,
                orders: {
                    ...state.orders,
                    customerPOs: state.orders.customerPOs.map((po: any) =>
                        po.po === action.payload.poId ? { ...po, ...action.payload.updatedFields } : po
                    ),
                },
            };
        case 'ADD_SALES_ORDER':
            return {
                ...state,
                orders: { ...state.orders, salesOrders: [...state.orders.salesOrders, action.payload] }
            };
        case 'UPDATE_ITEM_STOCK':
            return {
                ...state,
                items: state.items.map((item: any) =>
                    item.id === action.payload.itemId
                        ? { ...item, [action.payload.field]: action.payload.value }
                        : item
                ),
            };
        case 'ADD_PO':
            return {
                ...state,
                po: {
                    ...state.po,
                    [action.payload.stage]: [...state.po[action.payload.stage], action.payload.po]
                }
            };
        case 'MOVE_PO_STAGE': {
            const { poId, from, to } = action.payload;
            const poItem = state.po[from]?.find((p: any) => p.id === poId);
            if (!poItem) return state;
            return {
                ...state,
                po: {
                    ...state.po,
                    [from]: state.po[from].filter((p: any) => p.id !== poId),
                    [to]: [...(state.po[to] || []), poItem]
                }
            };
        }
        case 'COMPLETE_GRN': {
            const { poId: grnPoId, lineItemId, grnData } = action.payload;
            // Also update item stock if receivedQty is provided in grnData
            const newItems = grnData.receivedQty
                ? state.items.map((item: any) =>
                    item.id === lineItemId
                        ? { ...item, stock: (item.stock || 0) + grnData.receivedQty }
                        : item
                )
                : state.items;
            return {
                ...state,
                items: newItems,
                po: {
                    ...state.po,
                    issued: state.po.issued.map((po: any) =>
                        po.id === grnPoId
                            ? {
                                ...po,
                                lines: po.lines.map((line: any) =>
                                    line.itemId === lineItemId
                                        ? { ...line, grn: { ...line.grn, ...grnData } }
                                        : line
                                )
                            }
                            : po
                    ),
                },
            };
        }
        case 'CREATE_SO_FROM_CPO': {
            const { cpoId, soData, orderedProduct } = action.payload;
            const today = new Date().toISOString().slice(0, 10);
            const updatedCPOs = state.orders.customerPOs.map((cpo: any) =>
                cpo.po === cpoId
                    ? {
                        ...cpo,
                        status: 'so_created',
                        soRef: soData.so,
                        timeline: (cpo.timeline || []).map((t: any) =>
                            t.stage === 'SO Created' ? { ...t, date: today, done: true } : t
                        ),
                    }
                    : cpo
            );
            return {
                ...state,
                orders: {
                    ...state.orders,
                    customerPOs: updatedCPOs,
                    salesOrders: [...state.orders.salesOrders, soData],
                    orderedProducts: [...state.orders.orderedProducts, orderedProduct],
                },
            };
        }
        case 'ADD_ORDERED_PRODUCT':
            return {
                ...state,
                orders: {
                    ...state.orders,
                    orderedProducts: [...state.orders.orderedProducts, action.payload],
                },
            };
        case 'ADD_PLANNED_LINE': {
            const { line, itemId, qty } = action.payload;
            return {
                ...state,
                items: state.items.map((item: any) =>
                    item.id === itemId
                        ? { ...item, poQty: (item.poQty || 0) + qty }
                        : item
                ),
                po: {
                    ...state.po,
                    planned: [...(state.po.planned || []), line],
                },
            };
        }
        case 'MOVE_PLANNED_TO_DRAFT': {
            const { vendor: _vendor, draftPO, plannedLineIds } = action.payload;
            const remainingPlanned = (state.po.planned || []).filter(
                (l: any) => !plannedLineIds.includes(l.id)
            );
            return {
                ...state,
                po: {
                    ...state.po,
                    planned: remainingPlanned,
                    drafts: [...(state.po.drafts || []), draftPO],
                },
            };
        }
        case 'ADD_TREASURY_REQUEST':
            return {
                ...state,
                po: {
                    ...state.po,
                    treasury: [...(state.po.treasury || []), action.payload],
                },
            };
        case 'ISSUE_PO_FROM_TREASURY': {
            const { poId: issuePOId, itemUpdates } = action.payload;
            // Move PO from treasury → issued
            const poToIssue = (state.po.treasury || []).find((p: any) => p.id === issuePOId);
            if (!poToIssue) return state;
            const issuedPO = { ...poToIssue, status: 'ISSUED', issuedAt: new Date().toISOString().slice(0, 10) };
            const updatedItemsAfterIssue = state.items.map((item: any) => {
                const update = itemUpdates.find((u: any) => u.itemId === item.id);
                return update ? { ...item, inTransit: (item.inTransit || 0) + update.inTransitDelta } : item;
            });
            return {
                ...state,
                items: updatedItemsAfterIssue,
                po: {
                    ...state.po,
                    treasury: (state.po.treasury || []).filter((p: any) => p.id !== issuePOId),
                    issued: [...(state.po.issued || []), issuedPO],
                },
            };
        }
        case 'CREATE_BMR_BATCH': {
            const { batch, bmr, bpr } = action.payload;
            const newBPRs = bpr ? [...(state.mfg.bprs || []), bpr] : state.mfg.bprs || [];
            return {
                ...state,
                mfg: {
                    ...state.mfg,
                    batches: [...(state.mfg.batches || []), batch],
                    bmrs: [...(state.mfg.bmrs || []), bmr],
                    bprs: newBPRs,
                },
            };
        }
        case 'ADVANCE_BMR_STAGE': {
            const { bmrId, newStage } = action.payload;
            return {
                ...state,
                mfg: {
                    ...state.mfg,
                    bmrs: (state.mfg.bmrs || []).map((b: any) =>
                        b.id === bmrId ? { ...b, stage: newStage } : b
                    ),
                },
            };
        }
        case 'COMPLETE_BPR_QC': {
            const { bprId, bmrId } = action.payload;
            return {
                ...state,
                mfg: {
                    ...state.mfg,
                    bmrs: (state.mfg.bmrs || []).map((b: any) =>
                        b.id === bmrId ? { ...b, stage: 8, completedAt: new Date().toISOString().slice(0, 10) } : b
                    ),
                    bprs: (state.mfg.bprs || []).map((b: any) =>
                        b.id === bprId ? { ...b, stage: 4, completedAt: new Date().toISOString().slice(0, 10) } : b
                    ),
                },
            };
        }
        case 'ADVANCE_BPR_STAGE': {
            const { bprId: advBprId, newStage: bprNewStage } = action.payload;
            return {
                ...state,
                mfg: {
                    ...state.mfg,
                    bprs: (state.mfg.bprs || []).map((b: any) =>
                        b.id === advBprId ? { ...b, stage: bprNewStage } : b
                    ),
                },
            };
        }
        case 'ADD_MATERIAL_REQUEST': {
            return {
                ...state,
                mfg: {
                    ...state.mfg,
                    materialRequests: [...(state.mfg.materialRequests || []), action.payload],
                },
            };
        }
        case 'SPLIT_DRAFT_PO': {
            const { draftId: splitId, newDrafts } = action.payload;
            return {
                ...state,
                po: {
                    ...state.po,
                    drafts: [
                        ...(state.po.drafts || []).filter((d: any) => d.id !== splitId),
                        ...newDrafts,
                    ],
                },
            };
        }
        case 'RELEASE_DRAFT_PO': {
            const { draftId: relId } = action.payload;
            const draftToRelease = (state.po.drafts || []).find((d: any) => d.id === relId);
            if (!draftToRelease) return state;
            const terms = state.masters?.paymentTerms?.find((t: any) => t.id === draftToRelease.termsId);
            const advPct = terms?.advancePct || 0;
            if (advPct > 0) {
                const total = (draftToRelease.lines || []).reduce((s: number, l: any) => s + l.qty * l.unit, 0);
                const amount = Math.round(total * (advPct / 100));
                const req = {
                    reqId: 'TR-' + Math.random().toString(16).slice(2, 6).toUpperCase(),
                    poId: relId,
                    vendor: draftToRelease.vendor,
                    advancePct: advPct,
                    amount,
                    status: 'Pending',
                    createdAt: new Date().toISOString(),
                };
                return {
                    ...state,
                    po: {
                        ...state.po,
                        drafts: (state.po.drafts || []).map((d: any) =>
                            d.id === relId ? { ...d, status: 'AWAITING_ADVANCE' } : d
                        ),
                        treasury: [...(state.po.treasury || []), req],
                    },
                };
            } else {
                // Direct issue
                const poSeq = (state.po.seq?.po || 250023);
                const newPOId = 'PO-' + poSeq;
                const minDate = (arr: string[]) => {
                    const dates = arr.map(d => new Date(d).getTime());
                    return new Date(Math.min(...dates)).toISOString().slice(0, 10);
                };
                const issuedPO = {
                    id: newPOId,
                    vendor: draftToRelease.vendor,
                    vendorId: draftToRelease.vendorId,
                    status: 'ISSUED',
                    issuedAt: new Date().toISOString().slice(0, 10),
                    confirmation: 'Pending',
                    confAt: null,
                    expectedConnectivity: minDate((draftToRelease.lines || []).map((l: any) => l.expectedConnectivity || new Date().toISOString())),
                    expectedDelivery: minDate((draftToRelease.lines || []).map((l: any) => l.expectedDelivery || new Date().toISOString())),
                    expectedStockUpdate: minDate((draftToRelease.lines || []).map((l: any) => l.expectedStockUpdate || new Date().toISOString())),
                    dispatchStatus: 'Not dispatched',
                    delayed: false,
                    delayedTo: null,
                    termsId: draftToRelease.termsId,
                    notes: draftToRelease.notes || '—',
                    lines: (draftToRelease.lines || []).map((l: any) => ({
                        ...l,
                        grn: { status: 'Pending', validations: null, labels: [] },
                    })),
                };
                return {
                    ...state,
                    po: {
                        ...state.po,
                        drafts: (state.po.drafts || []).filter((d: any) => d.id !== relId),
                        issued: [...(state.po.issued || []), issuedPO],
                        seq: { ...state.po.seq, po: poSeq + 1 },
                    },
                };
            }
        }
        case 'MARK_TREASURY_PAID': {
            const { reqId: trReqId } = action.payload;
            return {
                ...state,
                po: {
                    ...state.po,
                    treasury: (state.po.treasury || []).map((r: any) =>
                        r.reqId === trReqId ? { ...r, status: 'Paid' } : r
                    ),
                },
            };
        }
        case 'CONFIRM_PO': {
            const { poId: confPoId, confAt } = action.payload;
            return {
                ...state,
                po: {
                    ...state.po,
                    issued: (state.po.issued || []).map((p: any) =>
                        p.id === confPoId ? { ...p, confirmation: 'Confirmed', confAt } : p
                    ),
                },
            };
        }
        case 'DISPATCH_PO': {
            const { poId: dispPoId } = action.payload;
            return {
                ...state,
                po: {
                    ...state.po,
                    issued: (state.po.issued || []).map((p: any) =>
                        p.id === dispPoId ? { ...p, dispatchStatus: 'In transit' } : p
                    ),
                },
            };
        }
        default:
            return state;
    }
};


const GlobalStateContext = createContext<{
    state: GlobalState;
    dispatch: React.Dispatch<GlobalAction>;
}>({ state: initialState, dispatch: () => null });

export const GlobalStateProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(globalReducer, initialState);
    return (
        <GlobalStateContext.Provider value={{ state, dispatch }}>
            {children}
        </GlobalStateContext.Provider>
    );
};

export const useGlobalState = () => useContext(GlobalStateContext);
