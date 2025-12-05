import { useEffect, useRef } from "react";

const OpenTableWidget = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const script = document.createElement('script');
    script.src = 'https://www.opentable.de/widget/reservation/loader?rid=115809&type=standard&theme=wide&color=36&dark=false&iframe=true&domain=de&lang=de-DE&newtab=false&ot_source=Restaurant%20website&cfe=true';
    script.async = true;
    containerRef.current.appendChild(script);
    
    return () => {
      if (containerRef.current) {
        const existingScript = containerRef.current.querySelector('script');
        if (existingScript) {
          existingScript.remove();
        }
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="bg-card p-6 rounded-lg border border-border shadow-lg"
    />
  );
};

export default OpenTableWidget;
