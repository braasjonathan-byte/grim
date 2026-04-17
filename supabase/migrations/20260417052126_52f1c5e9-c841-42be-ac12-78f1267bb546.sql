DELETE FROM public.custom_exercises
WHERE name ~* '\d+\s*[x×]\s*[\d.]+'
   OR name ~* '@\s*RPE'
   OR name ~* '\d+\s*min\b';