const FOOTER_TEXT = {
  uk: 'Радіо Сміхун',
  en: 'Radio Smihun',
};

export function Footer({ lang = 'uk', text = null }) {
  const year = new Date().getFullYear();
  const footerText = text || FOOTER_TEXT[lang] || FOOTER_TEXT.uk;

  return (
    <p className="text-center text-[10px] font-black tracking-widest uppercase text-gray-700 py-6 select-none mt-auto">
      {footerText} {year}
    </p>
  );
}
