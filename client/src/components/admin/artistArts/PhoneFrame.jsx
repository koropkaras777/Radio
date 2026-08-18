import { PHONE_RATIO } from './cropToPhoneJpg.js';

export function PhoneFrame({ imageUrl, emptyText }) {
  return (
    <div className="mx-auto w-full max-w-[220px]">
      <div
        className="overflow-hidden rounded-[1.75rem] border-[7px] border-black bg-black/30 shadow-2xl"
        style={{ aspectRatio: `${1} / ${PHONE_RATIO}` }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="block h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-wide text-gray-400">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}