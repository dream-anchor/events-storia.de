-- Create customer_profiles table
CREATE TABLE public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  -- Default delivery address
  delivery_street TEXT,
  delivery_city TEXT,
  delivery_zip TEXT,
  delivery_country TEXT DEFAULT 'Deutschland',
  -- Default billing address
  billing_name TEXT,
  billing_street TEXT,
  billing_city TEXT,
  billing_zip TEXT,
  billing_country TEXT DEFAULT 'Deutschland',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own profile" 
  ON public.customer_profiles FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" 
  ON public.customer_profiles FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" 
  ON public.customer_profiles FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Trigger for automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_customer();

-- Add user_id to catering_orders for order history
ALTER TABLE public.catering_orders ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Add trigger for updated_at on customer_profiles
CREATE TRIGGER update_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();