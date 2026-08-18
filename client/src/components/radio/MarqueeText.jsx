export function MarqueeText({ text, isMarquee, wrapperRef, innerRef, className }) {
  return (
    <div ref={wrapperRef} className={`marquee-wrapper ${isMarquee ? 'mask-active' : ''}`}>
      <div className={`flex w-max ${isMarquee ? 'animate-marquee' : ''} ${className}`}>
        <span ref={innerRef}>{text}</span>
        {isMarquee && <span className="ml-12">{text}</span>}
      </div>
    </div>
  );
}
