// Navigation model (spec §3.1). `perm` gates visibility by role.
// Icons are lucide-react component names, resolved in Sidebar.

export const NAV = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "BarChart3",
    perm: "orders.view",
    sub: [
      { label: "Overview", href: "/analytics" },
      { label: "Revenue & Sales", href: "/analytics/revenue" },
      { label: "Products", href: "/analytics/products" },
      { label: "Promotions & Coupons", href: "/analytics/promotions" },
    ],
  },
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
      { label: "All Orders", href: "/orders", countKey: "all" },
      { label: "New", href: "/orders?status=Pending", countKey: "pending" },
      { label: "Accepted", href: "/orders?status=Processing", countKey: "processing" },
      { label: "Shipped", href: "/orders?status=Shipped", countKey: "shipped" },
      { label: "Delivered", href: "/orders?status=Delivered", countKey: "delivered" },
      { label: "Cancelled", href: "/orders?status=Cancelled", countKey: "cancelled" },
    ],
  },
  { label: "Customers", href: "/customers", icon: "Users", perm: "customers.view" },
  {
    label: "Content",
    href: "/content/articles",
    icon: "PenLine",
    perm: "articles.create",
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
