import React, { useState, useEffect } from "react";
import { StaffSession, StaffInventoryItem, SaleReceipt } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Receipt,
  User,
  Phone,
  Bike,
  CreditCard,
  Banknote,
  Building,
  Printer,
  X,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

interface StaffSellReceiptProps {
  staffSession: StaffSession;
  onSaleCompleted?: (sale: SaleReceipt) => void;
  preselectedItem?: StaffInventoryItem | null;
  onClearPreselectedItem?: () => void;
}

interface CartItem {
  inventory_id: string;
  part_name: string;
  sku: string;
  category: string;
  unit_price: number;
  quantity: number;
  availableStock: number;
}

export function StaffSellReceipt({
  staffSession,
  onSaleCompleted,
  preselectedItem,
  onClearPreselectedItem,
}: StaffSellReceiptProps) {
  // Inventory state for search
  const [inventory, setInventory] = useState<StaffInventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Customer & sale details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [motorcycleModel, setMotorcycleModel] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "Cash" | "Transfer" | "Shop Account">("Card");
  const [notes, setNotes] = useState("");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Completed sale receipt modal
  const [completedSale, setCompletedSale] = useState<SaleReceipt | null>(null);

  // Fetch staff inventory
  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetch("/api/staff/inventory");
      const json = await res.json();
      if (json.items) {
        setInventory(json.items);
      }
    } catch (err) {
      console.error("Failed to load inventory for sales:", err);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Handle preselected item from inventory view
  useEffect(() => {
    if (preselectedItem) {
      addToCart(preselectedItem);
      if (onClearPreselectedItem) onClearPreselectedItem();
    }
  }, [preselectedItem]);

  const addToCart = (item: StaffInventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.inventory_id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock_quantity) {
          alert(`Cannot add more: only ${item.stock_quantity} units available in stock!`);
          return prev;
        }
        return prev.map((i) =>
          i.inventory_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      } else {
        if (item.stock_quantity <= 0) {
          alert("This part is currently out of stock!");
          return prev;
        }
        return [
          ...prev,
          {
            inventory_id: item.id,
            part_name: item.name,
            sku: item.sku,
            category: item.category,
            unit_price: item.selling_price || 0,
            quantity: 1,
            availableStock: item.stock_quantity,
          },
        ];
      }
    });
  };

  const updateQuantity = (inventory_id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.inventory_id === inventory_id) {
            const newQty = item.quantity + delta;
            if (newQty > item.availableStock) {
              alert(`Cannot exceed available stock of ${item.availableStock} units!`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (inventory_id: string) => {
    setCart((prev) => prev.filter((i) => i.inventory_id !== inventory_id));
  };

  // Calculations
  const subtotal = cart.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const taxRate = 0.08;
  const tax = Number((subtotal * taxRate).toFixed(2));
  const totalAmount = Number((subtotal + tax).toFixed(2));

  // Filtered parts for quick selection
  const filteredParts = inventory
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.location_bin && item.location_bin.toLowerCase().includes(q))
      );
    })
    .slice(0, 8); // Top 8 matches for quick selection

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage("Please enter customer name or company name.");
      return;
    }
    if (cart.length === 0) {
      setErrorMessage("Please add at least one part to the sell receipt.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        motorcycle_model: motorcycleModel.trim(),
        payment_method: paymentMethod,
        notes: notes.trim(),
        items: cart.map((c) => ({
          inventory_id: c.inventory_id,
          part_name: c.part_name,
          sku: c.sku,
          category: c.category,
          unit_price: c.unit_price,
          quantity: c.quantity,
        })),
        staff_id: staffSession.id,
        staff_username: staffSession.username,
        staff_name: staffSession.name,
        staff_email: staffSession.company_email,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to log sell receipt.");
      }

      setCompletedSale(json.receipt);
      if (onSaleCompleted) onSaleCompleted(json.receipt);

      // Refresh stock counts
      fetchInventory();

      // Reset form
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setMotorcycleModel("");
      setNotes("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to complete customer sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Staff Point of Sale
              </span>
              <span className="text-xs text-slate-400">
                Seller: <strong className="text-slate-200">{staffSession.name}</strong> ({staffSession.company_email})
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              Log Sell Receipt &amp; Customer Billing
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Select parts from on-hand inventory, enter customer or bike details, and generate an official workshop sell receipt. Stock is automatically decremented upon checkout.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-200 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Part Selector, Right Ticket/Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Part Picker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center">
                <Search className="w-4 h-4 mr-1.5 text-amber-400" />
                Select Parts from Inventory
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {inventory.length} parts in catalog
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search part name, SKU, category, or bin (e.g. Motul, Brake, Q3+)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Part Cards */}
            {isLoadingInventory ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                Loading parts catalog...
              </div>
            ) : filteredParts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                No matching parts found in inventory.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredParts.map((item) => {
                  const inCart = cart.find((c) => c.inventory_id === item.id);
                  const isOutOfStock = item.stock_quantity <= 0;

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 flex flex-col justify-between transition-all ${
                        isOutOfStock
                          ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                          : inCart
                          ? "bg-amber-950/20 border-amber-600/50"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-semibold text-slate-200 line-clamp-2">
                            {item.name}
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-400 shrink-0 ml-1">
                            {formatNpr(item.selling_price || 0)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1.5 text-[11px] font-mono text-slate-400">
                          <span>{item.sku}</span>
                          <span>•</span>
                          <span className="text-slate-500">{item.category}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
                        <div className="flex items-center space-x-2 text-[11px]">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                              item.stock_quantity <= 2
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {item.stock_quantity} in stock
                          </span>
                          {item.location_bin && (
                            <span className="text-slate-500 font-mono">{item.location_bin}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          disabled={isOutOfStock}
                          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            isOutOfStock
                              ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                              : inCart
                              ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                              : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {inCart ? `Add (${inCart.quantity})` : "Add"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Sale Ticket & Checkout (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <form
            onSubmit={handleSubmitSale}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Current Sell Receipt
                  </h3>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Customer Information */}
              <div className="space-y-2.5 mb-4">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe, Rider Mike, Apex Club"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Phone (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="(555) 000-0000"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Bike / Work Order
                    </label>
                    <div className="relative">
                      <Bike className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="e.g. Yamaha R6, WO-401"
                        value={motorcycleModel}
                        onChange={(e) => setMotorcycleModel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items in Cart */}
              <div className="border-t border-slate-800 pt-3 mb-4">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Ticket Items
                </div>

                {cart.length === 0 ? (
                  <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-lg p-5 text-center text-xs text-slate-500 font-mono">
                    <ShoppingCart className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                    No items selected yet. Click "Add" on any inventory item on the left.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.inventory_id}
                        className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 mr-2 min-w-0">
                          <p className="font-semibold text-slate-200 truncate">{item.part_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {formatNpr(item.unit_price)} ea • {item.sku}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center space-x-1.5 mr-3">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.inventory_id, -1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-white text-xs">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.inventory_id, 1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Total & Remove */}
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-amber-400 w-24 text-right">
                            {formatNpr(item.quantity * item.unit_price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.inventory_id)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="border-t border-slate-800 pt-3 mb-4">
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "Card", label: "Card", icon: CreditCard },
                    { id: "Cash", label: "Cash", icon: Banknote },
                    { id: "Transfer", label: "Transfer", icon: Building },
                    { id: "Shop Account", label: "Account", icon: User },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mb-1" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                  Sale Notes / Bay Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full, counter pickup, Bay 2 repair"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs font-mono mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>{formatNpr(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Shop Sales Tax (8.0%):</span>
                  <span>{formatNpr(tax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-1.5 border-t border-slate-800">
                  <span>Total Due:</span>
                  <span className="text-emerald-400">{formatNpr(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || cart.length === 0}
              className={`w-full py-2.5 px-4 rounded-lg font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md ${
                isSubmitting || cart.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Logging Sale &amp; Updating Stock...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>Log Sell Receipt ({formatNpr(totalAmount)})</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Completed Sale Receipt Slip Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  Sale Receipt Logged Successfully!
                </h3>
              </div>
              <button
                onClick={() => setCompletedSale(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Receipt Paper Container */}
            <div
              id="printable-sale-receipt"
              className="bg-white text-slate-950 p-6 rounded-lg font-mono text-xs space-y-4 shadow-inner"
            >
              {/* Receipt Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h2 className="text-base font-black tracking-tight uppercase">MOTOFIX GARAGE</h2>
                <p className="text-[11px] text-slate-600">Official Parts &amp; Service Counter</p>
                <p className="text-[10px] text-slate-500">1480 Speedway Blvd • (555) 019-4822</p>
                <div className="mt-2 text-xs font-bold text-slate-800">
                  RECEIPT #: {completedSale.receipt_number}
                </div>
                <div className="text-[10px] text-slate-500">
                  {new Date(completedSale.created_at).toLocaleString()}
                </div>
              </div>

              {/* Customer & Staff Info */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-3 text-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold">Customer:</span>
                  <span>{completedSale.customer_name}</span>
                </div>
                {completedSale.customer_phone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{completedSale.customer_phone}</span>
                  </div>
                )}
                {completedSale.motorcycle_model && (
                  <div className="flex justify-between">
                    <span>Motorcycle:</span>
                    <span>{completedSale.motorcycle_model}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Seller (Staff):</span>
                  <span>{completedSale.staff_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="font-semibold">{completedSale.payment_method}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-slate-800 text-[10px] uppercase">
                  <span>Description</span>
                  <span>Qty × Price = Total</span>
                </div>
                {completedSale.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] leading-tight">
                    <span className="truncate max-w-[200px]">{it.part_name}</span>
                    <span className="shrink-0 font-mono">
                      {it.quantity} × {formatNpr(it.unit_price)} = {formatNpr(it.quantity * it.unit_price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatNpr(completedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (8%):</span>
                  <span>{formatNpr(completedSale.tax)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-950 pt-1 border-t border-slate-400">
                  <span>TOTAL PAID:</span>
                  <span>{formatNpr(completedSale.total_amount)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                <p>Thank you for riding with MotoFix Garage!</p>
                <p>Retain receipt for parts warranty &amp; return exchange within 30 days.</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono"
              >
                Close &amp; Next Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
