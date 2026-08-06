// Navigation model (spec §3.1). `perm` gates visibility by role.
// Icons are lucide-react component names, resolved in Sidebar.

export const NAV = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  {
    label: "Products",
    href: "/products",
    icon: "Package",
    perm: "products.view",
    sub: [
      { label: "All Products", href: "/products" },
      { label: "Add Product", href: "/products/new", perm: "products.edit" },
    ],
  },
  {
    label: "Orders",
    href: "/orders",
    icon: "ShoppingCart",
    perm: "orders.view",
    badgeKey: "pendingOrders",
    sub: [
      { label: "All Orders", href: "/orders" },
      { label: "Pending", href: "/orders?status=Pending" },
      { label: "Shipped", href: "/orders?status=Shipped" },
    ],
  },
  { label: "Customers", href: "/customers", icon: "Users", perm: "customers.view" },
  {
    label: "Content",
    href: "/content/articles",
    icon: "PenLine",
    sub: [
      { label: "Blog Articles", href: "/content/articles" },
      { label: "Banners", href: "/content/banners" },
      { label: "Homepage", href: "/content/homepage" },
    ],
  },
  {
    label: "Coupons",
    href: "/coupons",
    icon: "Ticket",
    perm: "coupons.edit",
    sub: [
      { label: "All Coupons", href: "/coupons" },
      { label: "Add Coupon", href: "/coupons/new" },
    ],
  },
  {
    label: "Reviews",
    href: "/reviews",
    icon: "Star",
    perm: "reviews.moderate",
    badgeKey: "pendingReviews",
  },
  {
    label: "CMS Users",
    href: "/users",
    icon: "UserCog",
    perm: "users.manage",
    sub: [
      { label: "All Users", href: "/users" },
      { label: "Add User", href: "/users/new" },
    ],
  },
  { label: "Audit Log", href: "/audit-log", icon: "ScrollText", perm: "audit.own" },
  { label: "Settings", href: "/settings", icon: "Settings", perm: "settings.manage" },
];
