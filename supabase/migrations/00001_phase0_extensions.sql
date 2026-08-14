-- Phase 0: required Postgres extensions for LockedIn
create extension if not exists citext;
create extension if not exists pgcrypto;
