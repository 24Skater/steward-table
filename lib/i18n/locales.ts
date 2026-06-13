export const STOREFRONT_STRINGS = {
  EN: {
    // Cart actions
    addToCart: "Add to cart",
    removeFromCart: "Remove",
    cart: "Cart",
    checkout: "Checkout",
    proceedToCheckout: "Proceed to checkout",
    continueShopping: "Continue shopping",
    viewCartBar: "View order",
    yourOrder: "Your order",
    emptyCart: "Your cart is empty.",
    browseMenu: "Browse menu",
    editItem: "Edit",
    // Totals
    orderTotal: "Order total",
    subtotal: "Subtotal",
    tax: "Tax",
    tip: "Tip",
    // Order flow
    placeOrder: "Place order",
    orderConfirmed: "Order confirmed",
    orderNumber: "Order #",
    pickupReady: "Ready for pickup",
    thankYou: "Thank you for your order!",
    viewOrder: "View order",
    backToMenu: "Back to menu",
    // Fulfillment
    fulfillmentPickup: "Pickup",
    fulfillmentDelivery: "Delivery",
    fulfillmentDineIn: "Dine-in",
    // Modifiers / items
    required: "Required",
    optional: "Optional",
    soldOut: "Sold out",
    free: "Free",
    customize: "Customize",
    addItem: "Add",
    toOrder: "to order",
    // Menu / search
    allCategories: "All",
    searchPlaceholder: "Search items…",
    noItemsAvailable: "No items available right now.",
    checkBackSoon: "Check back soon.",
    noItemsInCategory: "No items in this category.",
    noItemsMatchQuery: "No items match",
    // Misc
    contactUs: "Contact us",
    poweredBy: "Powered by Steward Table",
  },
  ES: {
    // Cart actions
    addToCart: "Agregar al carrito",
    removeFromCart: "Eliminar",
    cart: "Carrito",
    checkout: "Pagar",
    proceedToCheckout: "Proceder al pago",
    continueShopping: "Seguir comprando",
    viewCartBar: "Ver pedido",
    yourOrder: "Tu pedido",
    emptyCart: "Tu carrito está vacío.",
    browseMenu: "Ver menú",
    editItem: "Editar",
    // Totals
    orderTotal: "Total del pedido",
    subtotal: "Subtotal",
    tax: "Impuesto",
    tip: "Propina",
    // Order flow
    placeOrder: "Realizar pedido",
    orderConfirmed: "Pedido confirmado",
    orderNumber: "Pedido #",
    pickupReady: "Listo para recoger",
    thankYou: "¡Gracias por tu pedido!",
    viewOrder: "Ver pedido",
    backToMenu: "Regresar al menú",
    // Fulfillment
    fulfillmentPickup: "Recoger",
    fulfillmentDelivery: "Entrega",
    fulfillmentDineIn: "Comer aquí",
    // Modifiers / items
    required: "Requerido",
    optional: "Opcional",
    soldOut: "Agotado",
    free: "Gratis",
    customize: "Personalizar",
    addItem: "Agregar",
    toOrder: "al pedido",
    // Menu / search
    allCategories: "Todo",
    searchPlaceholder: "Buscar artículos…",
    noItemsAvailable: "No hay artículos disponibles ahora.",
    checkBackSoon: "Vuelve pronto.",
    noItemsInCategory: "No hay artículos en esta categoría.",
    noItemsMatchQuery: "No hay artículos que coincidan con",
    // Misc
    contactUs: "Contáctanos",
    poweredBy: "Desarrollado por Steward Table",
  },
} as const;

export type Locale = "EN" | "ES";
export type StorefrontStrings = (typeof STOREFRONT_STRINGS)["EN"];
