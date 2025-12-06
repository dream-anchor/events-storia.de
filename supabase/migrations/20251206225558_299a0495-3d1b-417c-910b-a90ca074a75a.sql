-- Create order number sequence table
CREATE TABLE public.order_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  year integer NOT NULL,
  current_number integer NOT NULL DEFAULT 99,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(prefix, year)
);

-- Enable RLS
ALTER TABLE public.order_number_sequences ENABLE ROW LEVEL SECURITY;

-- Only service role can access (used by edge functions)
CREATE POLICY "Service role can manage sequences"
ON public.order_number_sequences
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to get next order number atomically
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_prefix text, p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  -- Insert or update the sequence, returning the new number
  INSERT INTO order_number_sequences (prefix, year, current_number)
  VALUES (p_prefix, p_year, 100)
  ON CONFLICT (prefix, year)
  DO UPDATE SET 
    current_number = order_number_sequences.current_number + 1,
    updated_at = now()
  RETURNING current_number INTO next_num;
  
  RETURN next_num;
END;
$$;