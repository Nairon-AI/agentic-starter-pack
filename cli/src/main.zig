const std = @import("std");
const zeke = @import("zeke");

const InstallMode = enum { all, choose };

const Install = zeke.cmd("install [target]", "Install all skills or launch the interactive skill picker, then write the recommended starter AGENTS.md.")
    .option("--all", "Install every skill without prompting")
    .option("--choose", "Open the interactive skill picker")
    .option("--skip-agents", "Do not write the starter AGENTS.md")
    .option("--no-backup", "Overwrite AGENTS.md without creating a backup")
    .example("nairon-skills install . --all")
    .example("nairon-skills install ~/code/my-repo --choose");

const List = zeke.cmd("list", "List the available skills in this repo");

const AgentsWrite = zeke.cmd("agents write [target]", "Write the starter AGENTS.md into a repo")
    .option("--no-backup", "Overwrite AGENTS.md without creating a backup");

fn getStdout() std.fs.File.DeprecatedWriter {
    return std.fs.File.stdout().deprecatedWriter();
}

fn getStderr() std.fs.File.DeprecatedWriter {
    return std.fs.File.stderr().deprecatedWriter();
}

fn targetDir(target: ?[]const u8) []const u8 {
    return target orelse ".";
}

fn stdinIsInteractive() bool {
    return std.posix.isatty(std.posix.STDIN_FILENO);
}

fn runCommand(allocator: std.mem.Allocator, argv: []const []const u8, cwd: []const u8) !void {
    var child = std.process.Child.init(argv, allocator);
    child.cwd = cwd;
    child.stdin_behavior = .Inherit;
    child.stdout_behavior = .Inherit;
    child.stderr_behavior = .Inherit;

    const term = try child.spawnAndWait();
    switch (term) {
        .Exited => |code| {
            if (code != 0) {
                return error.ChildProcessFailed;
            }
        },
        else => return error.ChildProcessFailed,
    }
}

fn runShellCommand(allocator: std.mem.Allocator, script: []const u8, cwd: []const u8) !void {
    const argv = [_][]const u8{
        "/bin/sh",
        "-lc",
        script,
    };
    try runCommand(allocator, &argv, cwd);
}

fn buildInstallSourceScriptPath(allocator: std.mem.Allocator) ![]u8 {
    return std.fs.cwd().realpathAlloc(allocator, "../scripts/build-install-source.sh");
}

fn runSkillsWithPreparedSource(allocator: std.mem.Allocator, cwd: []const u8, command: []const u8) !void {
    const build_script = try buildInstallSourceScriptPath(allocator);
    defer allocator.free(build_script);

    const script = try std.fmt.allocPrint(
        allocator,
        \\source_dir="$("{s}")"
        \\trap 'rm -rf "$source_dir"' EXIT
        \\{s}
    ,
        .{ build_script, command },
    );
    defer allocator.free(script);

    try runShellCommand(allocator, script, cwd);
}

fn shellCommandSucceeds(allocator: std.mem.Allocator, script: []const u8, cwd: []const u8) bool {
    const argv = [_][]const u8{
        "/bin/sh",
        "-lc",
        script,
    };

    var child = std.process.Child.init(&argv, allocator);
    child.cwd = cwd;
    child.stdin_behavior = .Ignore;
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;

    const term = child.spawnAndWait() catch return false;
    return switch (term) {
        .Exited => |code| code == 0,
        else => false,
    };
}

fn promptMode() !InstallMode {
    const stdout = getStdout();
    try stdout.print(
        \\Nairon Skills
        \\
        \\1. Install all skills + starter AGENTS.md (recommended)
        \\2. Choose specific skills interactively + starter AGENTS.md
        \\
        \\Select [1/2]:
    , .{});

    var buf: [64]u8 = undefined;
    const bytes_read = try std.fs.File.stdin().read(&buf);
    const line = std.mem.trim(u8, buf[0..bytes_read], " \r\n\t");

    if (line.len == 0 or std.mem.eql(u8, line, "1") or std.ascii.eqlIgnoreCase(line, "all")) {
        return .all;
    }
    return .choose;
}

fn promptWithDefault(allocator: std.mem.Allocator, label: []const u8, default_value: []const u8) ![]u8 {
    if (!stdinIsInteractive()) return allocator.dupe(u8, default_value);

    const stdout = getStdout();
    try stdout.print("{s} [{s}]: ", .{ label, default_value });

    var buf: [1024]u8 = undefined;
    const bytes_read = try std.fs.File.stdin().read(&buf);
    const line = std.mem.trim(u8, buf[0..bytes_read], " \r\n\t");

    if (line.len == 0) return allocator.dupe(u8, default_value);
    return allocator.dupe(u8, line);
}

fn writeFileIfMissing(dir: std.fs.Dir, sub_path: []const u8, data: []const u8) !void {
    dir.access(sub_path, .{}) catch |err| switch (err) {
        error.FileNotFound => {
            try dir.writeFile(.{
                .sub_path = sub_path,
                .data = data,
            });
            return;
        },
        else => return err,
    };
}

fn scaffoldProjectContextIfSelected(allocator: std.mem.Allocator, cwd: []const u8) !void {
    if (!skillInstalled(cwd, "project-context")) return;

    var dir = try std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true });
    defer dir.close();

    try dir.makePath("project-context/architecture");
    try dir.makePath("project-context/business-context");
    try dir.makePath("project-context/decisions");
    try dir.makePath("project-context/pitfalls");

    const real_cwd = try std.fs.cwd().realpathAlloc(allocator, cwd);
    defer allocator.free(real_cwd);
    const repo_name = std.fs.path.basename(real_cwd);

    const project_name = try promptWithDefault(allocator, "Project name", repo_name);
    defer allocator.free(project_name);
    const product_type = try promptWithDefault(allocator, "Product type", "software product");
    defer allocator.free(product_type);
    const product_stage = try promptWithDefault(allocator, "Product stage", "early");
    defer allocator.free(product_stage);
    const primary_users = try promptWithDefault(allocator, "Primary users", "TBD");
    defer allocator.free(primary_users);
    const team_owner = try promptWithDefault(allocator, "Team owner or main builder", "TBD");
    defer allocator.free(team_owner);

    const root_index = try std.fmt.allocPrint(
        allocator,
        \\# Project context
        \\
        \\Use this folder as the durable repo-local memory layer for coding agents.
        \\
        \\## Sections
        \\
        \\- [Principles](principles.md)
        \\- [Architecture overview](architecture/overview.md)
        \\- [Business context](business-context/index.md)
        \\- `decisions/`
        \\- `pitfalls/`
    ,
        .{},
    );
    defer allocator.free(root_index);

    const principles = try std.fmt.allocPrint(
        allocator,
        \\# Principles
        \\
        \\- Keep durable repo knowledge here instead of trapped in chat history.
        \\- Put always-on rules and workflow constraints in `AGENTS.md`.
        \\- Keep notes short, linkable, and specific.
        \\- Prefer one topic per decision or pitfall file.
    ,
        .{},
    );
    defer allocator.free(principles);

    const architecture = try std.fmt.allocPrint(
        allocator,
        \\# Architecture overview
        \\
        \\- Project: {s}
        \\- Product type: {s}
        \\- Main product surfaces:
        \\- Main services or apps:
        \\- External integrations:
        \\- Main data flow:
        \\- Trust boundaries worth remembering:
    ,
        .{ project_name, product_type },
    );
    defer allocator.free(architecture);

    const business_index = try std.fmt.allocPrint(
        allocator,
        \\# Business context
        \\
        \\- [Context](context.md)
        \\- [Glossary](glossary.md)
        \\- [Team](team.md)
    ,
        .{},
    );
    defer allocator.free(business_index);

    const business_context = try std.fmt.allocPrint(
        allocator,
        \\# Context
        \\
        \\- Project: {s}
        \\- Product type: {s}
        \\- Product stage: {s}
        \\- Primary users: {s}
        \\- Constraints that affect prioritization:
        \\- Important stakeholder or launch context:
    ,
        .{ project_name, product_type, product_stage, primary_users },
    );
    defer allocator.free(business_context);

    const glossary = try std.fmt.allocPrint(
        allocator,
        \\# Glossary
        \\
        \\Add domain terms that could confuse an agent.
        \\
        \\## Starter format
        \\
        \\- `Canonical term`: short definition
        \\- `Alias to avoid`: what people also say, if relevant
        \\- `Related term`: how it differs
    ,
        .{},
    );
    defer allocator.free(glossary);

    const team = try std.fmt.allocPrint(
        allocator,
        \\# Team
        \\
        \\- Owner or primary builder: {s}
        \\- Other contributors:
        \\- Technical / non-technical ownership notes:
    ,
        .{team_owner},
    );
    defer allocator.free(team);

    try writeFileIfMissing(dir, "project-context/index.md", root_index);
    try writeFileIfMissing(dir, "project-context/principles.md", principles);
    try writeFileIfMissing(dir, "project-context/architecture/overview.md", architecture);
    try writeFileIfMissing(dir, "project-context/business-context/index.md", business_index);
    try writeFileIfMissing(dir, "project-context/business-context/context.md", business_context);
    try writeFileIfMissing(dir, "project-context/business-context/glossary.md", glossary);
    try writeFileIfMissing(dir, "project-context/business-context/team.md", team);

    const stdout = getStdout();
    try stdout.print("Scaffolded project-context/ in {s}\n", .{cwd});
}

fn backupAndWriteAgents(allocator: std.mem.Allocator, cwd: []const u8, make_backup: bool) !void {
    var dir = try std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true });
    defer dir.close();
    const starter = try std.fs.cwd().readFileAlloc(allocator, "../AGENTS.md", 1024 * 1024);
    defer allocator.free(starter);

    if (make_backup) {
        dir.access("AGENTS.md", .{}) catch |err| switch (err) {
            error.FileNotFound => {},
            else => return err,
        };

        const existing = dir.readFileAlloc(allocator, "AGENTS.md", 1024 * 1024) catch |err| switch (err) {
            error.FileNotFound => null,
            else => return err,
        };

        if (existing) |content| {
            defer allocator.free(content);
            const backup_name = try std.fmt.allocPrint(allocator, "AGENTS.md.bak.{d}", .{std.time.timestamp()});
            defer allocator.free(backup_name);
            try dir.writeFile(.{
                .sub_path = backup_name,
                .data = content,
            });
        }
    }

    try dir.writeFile(.{
        .sub_path = "AGENTS.md",
        .data = starter,
    });
}

fn skillInstalled(cwd: []const u8, skill_name: []const u8) bool {
    var dir = std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true }) catch return false;
    defer dir.close();

    const agent_path = std.fmt.allocPrint(std.heap.smp_allocator, ".agents/skills/{s}", .{skill_name}) catch return false;
    defer std.heap.smp_allocator.free(agent_path);
    if (dir.access(agent_path, .{})) |_| return true else |_| {}

    return false;
}

fn installDependencyIfSelected(
    allocator: std.mem.Allocator,
    cwd: []const u8,
    skill_name: []const u8,
    tool_name: []const u8,
    check_script: []const u8,
    install_script: []const u8,
    manual_hint: []const u8,
) !void {
    if (!skillInstalled(cwd, skill_name)) return;
    if (shellCommandSucceeds(allocator, check_script, cwd)) return;

    const stdout = getStdout();
    try stdout.print("Installing {s} for skill {s}...\n", .{ tool_name, skill_name });

    runShellCommand(allocator, install_script, cwd) catch {
        const stderr = getStderr();
        try stderr.print(
            "Could not auto-install {s} for skill {s}. Manual install: {s}\n",
            .{ tool_name, skill_name, manual_hint },
        );
        return;
    };

    try stdout.print("Installed {s} for skill {s}.\n", .{ tool_name, skill_name });
}

fn installSelectedDependencies(allocator: std.mem.Allocator, cwd: []const u8) !void {
    try installDependencyIfSelected(
        allocator,
        cwd,
        "browser-qa",
        "agent-browser",
        "command -v agent-browser >/dev/null 2>&1",
        "npm install -g agent-browser && agent-browser install",
        "npm install -g agent-browser && agent-browser install",
    );

    try installDependencyIfSelected(
        allocator,
        cwd,
        "desloppify",
        "desloppify",
        "command -v desloppify >/dev/null 2>&1",
        "if command -v pipx >/dev/null 2>&1; then pipx install 'desloppify[full]' || pipx upgrade 'desloppify[full]'; elif command -v python3 >/dev/null 2>&1; then python3 -m pip install --user --upgrade 'desloppify[full]'; else exit 1; fi",
        "pipx install 'desloppify[full]' or python3 -m pip install --user --upgrade 'desloppify[full]'",
    );

    try installDependencyIfSelected(
        allocator,
        cwd,
        "github-triage",
        "gh",
        "command -v gh >/dev/null 2>&1",
        "if command -v brew >/dev/null 2>&1; then brew install gh; elif command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y gh; elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y gh; elif command -v pacman >/dev/null 2>&1; then sudo pacman -Sy --noconfirm github-cli; elif command -v winget >/dev/null 2>&1; then winget install --id GitHub.cli -e; else exit 1; fi",
        "install GitHub CLI from https://cli.github.com/ or your OS package manager",
    );
}

fn hasInstallArtifacts(cwd: []const u8) bool {
    var dir = std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true }) catch return false;
    defer dir.close();

    dir.access("skills-lock.json", .{}) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return false,
    };
    if (dir.access("skills-lock.json", .{})) |_| return true else |_| {}

    dir.access(".agents/skills", .{}) catch |err| switch (err) {
        error.FileNotFound => return false,
        else => return false,
    };
    return true;
}

fn installAll(allocator: std.mem.Allocator, cwd: []const u8) !void {
    try runSkillsWithPreparedSource(
        allocator,
        cwd,
        "npx -y skills@latest add \"$source_dir\" --all -y",
    );
}

fn installChoose(allocator: std.mem.Allocator, cwd: []const u8) !void {
    try runSkillsWithPreparedSource(
        allocator,
        cwd,
        "npx -y skills@latest add \"$source_dir\"",
    );
}

fn listSkills(allocator: std.mem.Allocator) !void {
    try runSkillsWithPreparedSource(
        allocator,
        ".",
        "npx -y skills@latest add \"$source_dir\" --list",
    );
}

fn installAction(args: Install.Args, opts: Install.Options) !void {
    if (opts.all and opts.choose) {
        const stderr = getStderr();
        try stderr.print("Choose either --all or --choose, not both.\n", .{});
        return error.InvalidArguments;
    }

    const allocator = std.heap.smp_allocator;
    const cwd = targetDir(args.target);
    const make_backup = !opts.no_backup;

    try std.fs.cwd().makePath(cwd);

    const mode: InstallMode = if (opts.all)
        .all
    else if (opts.choose)
        .choose
    else
        try promptMode();

    switch (mode) {
        .all => try installAll(allocator, cwd),
        .choose => try installChoose(allocator, cwd),
    }

    if (hasInstallArtifacts(cwd)) {
        try installSelectedDependencies(allocator, cwd);
        try scaffoldProjectContextIfSelected(allocator, cwd);
    }

    if (!opts.skip_agents and hasInstallArtifacts(cwd)) {
        try backupAndWriteAgents(allocator, cwd, make_backup);
        const stdout = getStdout();
        try stdout.print("Wrote starter AGENTS.md in {s}\n", .{cwd});
    } else if (!opts.skip_agents) {
        const stdout = getStdout();
        try stdout.print("Skipped starter AGENTS.md because no skills were installed in {s}\n", .{cwd});
    }
}

fn listAction(_: List.Args, _: List.Options) !void {
    try listSkills(std.heap.smp_allocator);
}

fn agentsWriteAction(args: AgentsWrite.Args, opts: AgentsWrite.Options) !void {
    const allocator = std.heap.smp_allocator;
    const cwd = targetDir(args.target);

    try std.fs.cwd().makePath(cwd);
    try backupAndWriteAgents(allocator, cwd, !opts.no_backup);

    const stdout = getStdout();
    try stdout.print("Wrote starter AGENTS.md in {s}\n", .{cwd});
}

pub fn main() !void {
    var app = zeke.App(.{
        Install.bind(installAction),
        List.bind(listAction),
        AgentsWrite.bind(agentsWriteAction),
    }).init(std.heap.smp_allocator, "nairon-skills");

    app.setVersion("0.1.0");
    try app.run();
}
