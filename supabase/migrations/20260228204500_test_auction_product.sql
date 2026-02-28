-- Insert a test product auction
-- Uses the admin user account to create the test auction
-- Image: public Unsplash image of a laptop

INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  end_time,
  status,
  created_by
)
SELECT
  'MacBook Pro 16" M3 Max - 48GB RAM',
  'Laptop de alto rendimiento con chip M3 Max, 48GB de memoria unificada, 1TB SSD. En excelentes condiciones, garantía Apple de 1 año restante. Ideal para diseño, video, programación y gaming.',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
  850.00,
  0.00,
  now() + INTERVAL '3 days 6 hours',
  'active',
  id
FROM auth.users
WHERE email = 'uniformeskronus@gmail.com'
LIMIT 1;
