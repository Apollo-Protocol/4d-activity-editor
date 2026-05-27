FROM debian:bookworm-slim

# 1. Install Node and basic tools as ROOT
RUN apt-get update && apt-get install -y \
    curl git unzip ca-certificates sudo \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 2. Configure Corepack while we are still ROOT
# This allows it to create symlinks in /usr/bin without permission errors
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# 3. Setup the user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME

RUN cp /etc/skel/.bashrc /home/vscode/.bashrc \
    && cp /etc/skel/.profile /home/vscode/.profile \
    && chown vscode:vscode /home/vscode/.bashrc /home/vscode/.profile

# 4. NOW switch to the vscode user for the rest of the setup
USER $USERNAME
WORKDIR /workspace

# Set the home for corepack so it doesn't try to write to root-only areas later
ENV COREPACK_HOME=/home/vscode/.corepack
RUN mkdir -p /home/vscode/.claude