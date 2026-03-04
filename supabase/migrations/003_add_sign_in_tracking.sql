-- Function to retrieve user sign-in sessions from auth.sessions
-- Reads IP addresses, user agents, and timestamps (admin-only via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_sign_ins(user_uuid uuid, max_entries integer DEFAULT 10)
  RETURNS TABLE(event_at timestamp with time zone, ip text, user_agent text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT s.created_at AS event_at,
           split_part(s.ip::TEXT, '/', 1) AS ip,
           s.user_agent
    FROM auth.sessions s
    WHERE s.user_id = user_uuid
    ORDER BY s.created_at DESC
    LIMIT max_entries;
END;
$function$;
