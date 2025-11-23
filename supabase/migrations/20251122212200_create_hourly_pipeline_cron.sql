-- Create hourly cron job to run arbitrage pipeline
create extension if not exists pg_cron;

-- Schedule the hourly pipeline run
select cron.schedule(
  'arbitrage-pipeline-hourly',
  '0 * * * *',
  $$
  select
    net.http_post(
      url := 'https://llacdpsuxxfomppbechd.supabase.co/functions/v1/arbitrage-pipeline',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
select * from cron.job where jobname = 'arbitrage-pipeline-hourly';

comment on extension pg_cron is 'Cron-based job scheduler for PostgreSQL';
