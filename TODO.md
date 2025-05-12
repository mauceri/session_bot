# TODO

Below is a list of suggested improvements and enhancements to consider for future development:

## Documentation
- Add screenshots or GIFs demonstrating typical session_bot usage (invoking plugins via Session Messenger).
- Include an architecture diagram illustrating the data flow between the TypeScript broker and the Python plugin manager.
- Provide a step-by-step guide for creating and registering new plugins (plugin developer documentation).
- Add example entries in `data/plugins.yaml` with explanations of each field.
- Expand the configuration reference for `data/config.yaml` and environment variables (e.g., CLIENT_NAME, HOST_IP).
- Create a troubleshooting section covering common errors, reconnection issues, and log inspection.

## Core Features
- Implement dynamic plugin discovery or hot-reload in the Python manager without restarting the service.
- Add health checks and status reporting for connected plugins in the broker.
- Introduce versioning and dependency management for plugins.
- Support advanced message routing or filtering based on metadata or user permissions.
- Integrate performance metrics and telemetry (e.g., message latency, error rates).

## Testing & CI
- Expand unit test coverage for edge cases in the chunker and validator modules.
- Develop end-to-end integration tests simulating the full Session.js ↔ plugin_manager workflow.
- Set up a CI pipeline (GitHub Actions, GitLab CI) to run TypeScript and Python tests on each pull request.
- Add linting, type checks, and Docker build tests into the CI process.

## Developer Experience
- Provide code snippets or an interactive REPL for quickly experimenting with the broker API.
- Add verbose or debug logging modes to assist in development and troubleshooting.
- Create a CLI tool or subcommands for plugin registration, configuration, and status monitoring.

## Miscellaneous
- Conduct a security review of input handling and plugin isolation to prevent code injection.
- Consider localization of documentation into additional languages (e.g., Spanish, Chinese).