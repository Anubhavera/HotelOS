#!/usr/bin/env python3
"""Test migrations with synthetic users in a disposable local PostgreSQL cluster."""
import os
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[1]
bindir = Path(os.environ.get("PG_BINDIR", "/usr/lib/postgresql/18/bin"))
with tempfile.TemporaryDirectory(prefix="hotelos-test-") as directory:
    base = Path(directory)
    database = base / "db"
    socket = base / "socket"
    socket.mkdir()
    started = False
    connection = ["psql", "-h", str(socket), "-p", "55483", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]
    try:
        subprocess.run([str(bindir / "initdb"), "-D", str(database), "-A", "trust", "--no-locale"], check=True, stdout=subprocess.DEVNULL)
        # Unix socket only: no network listener or real credentials.
        subprocess.run([str(bindir / "pg_ctl"), "-D", str(database), "-l", str(base / "postgres.log"), "-o", f"-k {socket} -p 55483 -h ''", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
        started = True
        setup = """CREATE ROLE authenticated;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users(id UUID PRIMARY KEY, email TEXT, email_confirmed_at TIMESTAMPTZ);
        CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$
          SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;"""
        subprocess.run(connection + ["-c", setup], check=True, stdout=subprocess.DEVNULL)
        for migration in sorted((repo / "supabase/migrations").glob("*.sql")):
            subprocess.run(connection + ["-f", str(migration)], check=True, stdout=subprocess.DEVNULL)
        test_args = [arg for test in sorted((repo / "tests").glob("*.sql")) for arg in ("-f", str(test))]
        subprocess.run(connection + test_args, check=True)
    finally:
        if started:
            subprocess.run([str(bindir / "pg_ctl"), "-D", str(database), "-m", "fast", "-w", "stop"], check=True, stdout=subprocess.DEVNULL)
