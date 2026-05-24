
ALTER FUNCTION public._fmt_date(date) SET search_path = public;
ALTER FUNCTION public._fmt_money(numeric) SET search_path = public;
ALTER FUNCTION public._fmt_bool(boolean) SET search_path = public;
ALTER FUNCTION public._fmt_text(text) SET search_path = public;
ALTER FUNCTION public._fmt_address(text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public._log_field_change(text,uuid,text,text,text,text,text) SET search_path = public;
