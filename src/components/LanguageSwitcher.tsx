import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-foreground/5 rounded-full p-1">
      <button
        onClick={() => setLanguage("de")}
        className={`min-h-[40px] min-w-[40px] px-3 py-2 text-sm font-medium rounded-full transition-all duration-200 touch-manipulation ${
          language === "de"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        }`}
      >
        DE
      </button>
      <button
        onClick={() => setLanguage("en")}
        className={`min-h-[40px] min-w-[40px] px-3 py-2 text-sm font-medium rounded-full transition-all duration-200 touch-manipulation ${
          language === "en"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
