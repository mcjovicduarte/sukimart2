"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

const stories = [
  {
    title: "Lahat ng Kailangan, Nasa Sukimart!",
    description:
      "Your neighborhood store, now online. Shop your everyday essentials anytime, anywhere.",
  },
  {
    title: "Paborito mong meryenda, isang tap lang.",
    description:
      "Stock up on your go-to snacks, noodles, and drinks without leaving home.",
  },
  {
    title: "Pang-araw-araw, mas pinadali.",
    description:
      "From pantry staples to household essentials, your local favorites are close by.",
  },
  {
    title: "Malapit sa'yo, kahit nasaan ka.",
    description:
      "A little taste of your neighborhood store, delivered right to your doorstep.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [activeStory, setActiveStory] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setActiveStory((current) => (current + 1) % stories.length), 5000);
    return () => window.clearTimeout(timer);
  }, [activeStory, reducedMotion]);

  return (
    <div className="authLayout">
      <aside className="storyPanel" aria-label="Sukimart highlights" aria-roledescription="carousel">
        <div className="storyArt">
          <Image
            className="storeIllustration"
            src="/sari-sari-store.svg"
            alt="Illustration of a neighborhood sari-sari store"
            width={760}
            height={560}
            priority
          />
        </div>
        <div className="storyCopy">
          {stories.map((story, index) => (
            <div key={story.title} className={`storyMessage${index === activeStory ? " storyMessageActive" : ""}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${stories.length}`} aria-hidden={index !== activeStory}>
              <h2>{story.title}</h2>
              <p>{story.description}</p>
            </div>
          ))}
        </div>
        <div className="carouselIndicators" aria-label="Sukimart highlights">
          {stories.map((item, index) => (
            <button
              key={item.title}
              className={`indicator${activeStory === index ? " indicatorActive" : ""}`}
              type="button"
              aria-label={`Show highlight ${index + 1}: ${item.title}`}
              aria-pressed={activeStory === index}
              onClick={() => setActiveStory(index)}
            />
          ))}
        </div>
      </aside>
      <main className="loginPanel">{children}</main>
    </div>
  );
}
