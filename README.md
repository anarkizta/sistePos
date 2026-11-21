This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# sistePos

**sistePos** is an open-source, self-hosted Point-of-Sale (POS) and cash-register audit system built with **Next.js**. Inspired by high-speed desktop cash registers, it is designed for retail environments that require keyboard-driven checkout workflows, hardware integration, and automated visual loss-prevention auditing.

## Core Features

- **High-Speed Keyboard-Driven Checkout:** Built for rapid retail operation without relying on mouse navigation (shortcut-driven workflows for scanning, quantities, discounts, and checkout).
- **Hardware Integration:** Compatible with standard USB/Serial barcode scanners, thermal receipt printers, and automated cash drawers.
- **Inventory & Sales Management:** Real-time stock tracking, shift closures (cash cuts), and detailed transaction history.
- **Timezone-Accurate Auditing:** Strict UTC storage across database records with localized timezone rendering to prevent clock drift across terminals.

## Roadmap & Active Development

- [ ] **Camera & NVR Event Synchronization:** Asynchronous webhook bridge to link critical POS events (completed sales, voided items, manual discounts, and no-sale drawer openings) with local RTSP/ONVIF IP camera feeds.
- [ ] **NTP Time Alignment:** Local NTP clock synchronization between POS terminals, database servers, and NVR OSD timestamps for frame-accurate audit verification.
- [ ] **Offline-Resilient Event Queue:** Non-blocking local queue (`PENDING_SYNC`) ensuring checkout speed is never degraded if local camera hardware or network services go offline.

## Tech Stack

- **Framework:** Next.js (React / TypeScript)
- **Database & ORM:** Relational SQL / Prisma (configurable for MySQL / PostgreSQL)
- **Video Bridge (In Progress):** MediaMTX / FFmpeg / RTSP-ONVIF webhooks

