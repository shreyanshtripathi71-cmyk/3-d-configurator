OpenSpec — Design Handoff
=========================

Three files, three uses. Pick what your developer needs:

01-source-code.zip      ~110 KB  — Full editable Next.js project.
                                   Unzip, then:  npm install && npm run dev
                                   Open http://localhost:3000

02-built-site.zip       ~560 KB  — Production-ready static export.
                                   Unzip, then:  cd out && python3 -m http.server 8000
                                   Open http://localhost:8000
                                   (Or upload the unzipped 'out/' folder to Netlify,
                                    Vercel, S3, GitHub Pages — drag-and-drop deploys.)

03-quick-preview.html   ~560 KB  — Single self-contained file.
                                   DOUBLE-CLICK to open in any browser.
                                   Static visual preview — interactive bits
                                   (forms, dialog, tabs, color cycle) are
                                   disabled because no JS runs in this version.

Stack
-----
Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript

Key folders inside the source zip
---------------------------------
src/app/(main)/page.tsx     The homepage — composes every section in order
src/components/             Each section is one file (Hero, Industries,
                            BuiltFor, Catalog, HowItWorks, CloserLook,
                            Enterprise, Testimonial, Pricing, Faq, Cta,
                            Footer, Navbar, DemoDialog)
src/app/globals.css         Color tokens, glass utilities, all animations
src/components/DemoDialog.tsx
                            The "Book a walkthrough" pop-up form
