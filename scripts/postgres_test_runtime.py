"""Readiness for the pinned official PostgreSQL disposable test image."""
import subprocess
import time

def wait_for_postgres(name, timeout=60):
    # docker-entrypoint starts a temporary socket-only server for init scripts.
    # A real TCP query succeeds only after that server is stopped and the final
    # server is listening. Never proceed with test SQL on deadline exhaustion.
    deadline = time.monotonic() + timeout
    command = ['docker', 'exec', '-e', 'PGCONNECT_TIMEOUT=2', name,
               'psql', '-X', '-qAt', '-h', '127.0.0.1', '-U', 'postgres',
               '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1']
    while time.monotonic() < deadline:
        try:
            result = subprocess.run(command, capture_output=True, text=True,
                                    timeout=min(4, max(.1, deadline-time.monotonic())))
            if result.returncode == 0 and result.stdout.strip() == '1':
                return
        except subprocess.TimeoutExpired:
            pass
        remaining = deadline-time.monotonic()
        if remaining > 0:
            time.sleep(min(.25, remaining))
    # State only: never dump the container's environment or connection secrets.
    state = subprocess.run(
        ['docker', 'inspect', '--format',
         'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}', name],
        capture_output=True, text=True, timeout=5)
    summary = state.stdout.strip() if state.returncode == 0 else 'state unavailable'
    raise RuntimeError('Isolated PostgreSQL TCP readiness timed out: '+summary)
