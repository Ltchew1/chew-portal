// app/components/lab/RevealOnScroll.js
//
// Staggered fade-rise-in-on-scroll for the room gallery — matters most on
// mobile, where six tiles don't all fit above the fold. Uses
// IntersectionObserver rather than a scroll listener; disconnects after
// the first reveal since tiles only need to appear once.
//
// Polymorphic (`as="link"` + `href`) so the revealed element IS the
// clickable room tile itself — no extra wrapper div duplicating the same
// visual classes around an inner Link.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function RevealOnScroll({ children, delay = 0, className = '', as = 'div', href }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const combinedClassName = `${className}${visible ? ' revealed' : ''}`;
  const style = { transitionDelay: visible ? `${delay}ms` : '0ms' };

  if (as === 'link' && href) {
    return (
      <Link href={href} ref={ref} className={combinedClassName} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <div ref={ref} className={combinedClassName} style={style}>
      {children}
    </div>
  );
}
