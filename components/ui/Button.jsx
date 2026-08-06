"use client";

import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "border-line bg-card text-ink hover:border-[#CFD6E0] hover:bg-[#FBFCFD]",
        primary:
          "border-teal bg-teal font-semibold text-teal-ink hover:border-teal-hover hover:bg-teal-hover",
        dark: "border-navy bg-navy text-white hover:border-navy-2 hover:bg-navy-2",
        ghost: "border-transparent bg-transparent hover:bg-grey-wash",
        danger: "border-[#F3D6D4] text-red-deep hover:border-[#EBBDB9] hover:bg-red-wash",
      },
      size: {
        default: "px-[13px] py-2 text-[13px]",
        sm: "gap-1.5 rounded-[7px] px-2.5 py-[5px] text-[12.5px]",
        icon: "p-[7px]",
        "icon-sm": "rounded-[7px] p-[5px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const Button = forwardRef(function Button(
  { className, variant, size, ...props },
  ref
) {
  return <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />;
});

export { Button, button };
