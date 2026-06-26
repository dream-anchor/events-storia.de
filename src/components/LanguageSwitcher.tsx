import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-primary-foreground/10 rounded-full p-1">
      <button
        onClick={() => setLanguage("de")}
        aria-pressed={language === "de"}
        aria-label="Deutsch"
        className={`min-h-[40px] min-w-[40px] px-3 py-2 text-sm font-medium rounded-full transition-all duration-200 touch-manipulation ${
          language === "de"
            ? "bg-primary-foreground text-primary shadow-sm"
            : "text-primary-foreground/80 hover:text-primary-foreground"
        }`}
      >
        DE
      </button>
      <button
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        aria-label="English"
        className={`min-h-[40px] min-w-[40px] px-3 py-2 text-sm font-medium rounded-full transition-all duration-200 touch-manipulation ${
          language === "en"
            ? "bg-primary-foreground text-primary shadow-sm"
            : "text-primary-foreground/80 hover:text-primary-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
