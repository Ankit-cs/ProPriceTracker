"use client";

import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from "react-responsive-carousel";

export default function HeroCarousel({ products = [] }) {
  // If we have tracked products, showcase up to 5 of them, otherwise use some generic placeholder images
  const items = products.length > 0 
    ? products.slice(0, 5).map(p => ({ imgUrl: p.image_url, alt: p.name }))
    : [
        { imgUrl: "/assets/images/hero-1.svg", alt: "smartwatch" },
        { imgUrl: "/assets/images/hero-2.svg", alt: "bag" },
        { imgUrl: "/assets/images/hero-3.svg", alt: "lamp" },
        { imgUrl: "/assets/images/hero-4.svg", alt: "air fryer" },
        { imgUrl: "/assets/images/hero-5.svg", alt: "chair" },
        { imgUrl: "/assets/images/trending.svg", alt: "trending" },
        { imgUrl: "/assets/images/details.svg", alt: "details" },
      ];

  return (
    <div className="relative px-6 py-8 max-w-[560px] h-[450px] w-full bg-white/50 backdrop-blur-sm border border-line rounded-[30px] mx-auto mt-10 shadow-lg">
      <h3 className="text-center text-ink-soft text-sm font-semibold mb-4 uppercase tracking-wider">
        {products.length > 0 ? "Currently Tracking" : "Trending Products"}
      </h3>
      <Carousel
        showThumbs={false}
        autoPlay
        infiniteLoop
        interval={3000}
        showArrows={true}
        showStatus={false}
        className="h-[350px]"
        renderArrowPrev={(onClickHandler, hasPrev, label) =>
          hasPrev && (
            <button type="button" onClick={onClickHandler} title={label} className="absolute z-10 left-2 top-1/2 -translate-y-1/2 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-black flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )
        }
        renderArrowNext={(onClickHandler, hasNext, label) =>
          hasNext && (
            <button type="button" onClick={onClickHandler} title={label} className="absolute z-10 right-2 top-1/2 -translate-y-1/2 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-black flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          )
        }
        renderIndicator={(onClickHandler, isSelected, index, label) => {
          return (
            <li
              className={`inline-block mx-1.5 w-2 h-2 rounded-full cursor-pointer transition-colors ${
                isSelected ? "bg-black" : "bg-black/20 hover:bg-black/40"
              }`}
              onClick={onClickHandler}
              onKeyDown={onClickHandler}
              value={index}
              key={index}
              role="button"
              tabIndex={0}
              title={`${label} ${index + 1}`}
              aria-label={`${label} ${index + 1}`}
            />
          );
        }}
      >
        {items.map((image) => (
          <div key={image.alt} className="flex flex-col justify-center items-center h-[320px] px-4">
            {image.imgUrl ? (
              <img 
                src={image.imgUrl}
                alt={image.alt}
                className="object-contain max-h-[250px] w-auto max-w-full"
              />
            ) : (
              <div className="h-[250px] flex items-center justify-center text-ink-muted bg-surface/50 w-full rounded-xl">No Image</div>
            )}
            <p className="mt-4 text-sm font-medium text-ink line-clamp-1">{image.alt}</p>
          </div>
        ))}
      </Carousel>
    </div>
  );
}
