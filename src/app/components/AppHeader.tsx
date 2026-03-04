"use client";

import Link from "next/link";
import Image from "next/image";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/images/logo1.png"
            alt="2K Quant"
            width={28}
            height={28}
          />
        </Link>

        <div className="flex items-center gap-2">{/* ex) 알림/프로필 */}</div>
      </div>
    </header>
  );
}
