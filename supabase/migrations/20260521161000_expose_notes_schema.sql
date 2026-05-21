-- Expose notes schema via PostgREST (required for Supabase client access)
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, users, onboarding, recruiting, team_kalender, zeiterfassung, notes';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
