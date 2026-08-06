import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash font-mono text-[15px] font-semibold text-teal-deep">
          404
        </div>
        <h1 className="mb-1.5 text-[18px] font-semibold">Page not found</h1>
        <p className="mb-5 text-[13px] text-muted">That page doesn't exist in the CMS.</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-md border border-navy bg-navy px-3.5 py-2 text-[13px] font-medium text-white hover:bg-navy-2"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
