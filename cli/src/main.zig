const std = @import("std");
const zeke = @import("zeke");

const Install = zeke.cmd("install [target]", "Install all skills, install supported tool dependencies, and write the recommended starter AGENTS.md.")
    .option("--skip-agents", "Do not write the starter AGENTS.md")
    .option("--no-backup", "Overwrite AGENTS.md without creating a backup")
    .example("nairon-skills install .")
    .example("nairon-skills install ~/code/my-repo");

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

fn writeFile(dir: std.fs.Dir, sub_path: []const u8, data: []const u8) !void {
    try dir.writeFile(.{
        .sub_path = sub_path,
        .data = data,
    });
}

fn writeProjectContextBootstrapPromptIfSelected(allocator: std.mem.Allocator, cwd: []const u8) !void {
    if (!skillInstalled(cwd, "project-context")) return;

    var dir = try std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true });
    defer dir.close();

    const real_cwd = try std.fs.cwd().realpathAlloc(allocator, cwd);
    defer allocator.free(real_cwd);
    const repo_name = std.fs.path.basename(real_cwd);
    try dir.makePath("project-context");

    const prompt = try std.fmt.allocPrint(
        allocator,
        \\# Project-context bootstrap prompt
        \\
        \\Paste this into your coding agent after install:
        \\
        \\```text
        \\Use the installed `project-context` skill and bootstrap the repo-local context vault for this repository.
        \\
        \\Repository: {s}
        \\Absolute path: {s}
        \\
        \\Your job:
        \\1. Scan the repo first before asking questions.
        \\2. Read the highest-signal files first: `README*`, `AGENTS.md`, package manifests, lockfiles, top-level app folders, `docs/`, CI config, deployment config, database/schema files, API routes, and major UI entrypoints.
        \\3. Infer as much as possible from the codebase before asking anything.
        \\4. Then build or refresh:
        \\   - `project-context/index.md`
        \\   - `project-context/principles.md`
        \\   - `project-context/architecture/overview.md`
        \\   - `project-context/business-context/index.md`
        \\   - `project-context/business-context/context.md`
        \\   - `project-context/business-context/glossary.md`
        \\   - `project-context/business-context/team.md`
        \\   - topic files under `project-context/decisions/` and `project-context/pitfalls/` when the repo clearly warrants them
        \\5. Do not fill the folder with vague placeholders. If the repo already answers something, write the answer.
        \\6. Only ask targeted follow-up questions for gaps the repo cannot answer, like user segments, internal ownership, or business terminology not present in code/docs.
        \\7. Keep the result concise, durable, and linkable.
        \\
        \\Rules:
        \\- `AGENTS.md` is for always-on instructions and workflow rules.
        \\- `project-context/` is for durable repo memory, business context, architecture, decisions, and pitfalls.
        \\- Prefer bullets over essays.
        \\- One topic per decision/pitfall file.
        \\- If a glossary exists already, merge instead of overwrite.
        \\```
    ,
        .{ repo_name, real_cwd },
    );
    defer allocator.free(prompt);

    try writeFile(dir, "project-context/BOOTSTRAP_PROMPT.md", prompt);

    const stdout = getStdout();
    try stdout.print(
        \\Created project-context bootstrap prompt in {s}/project-context/BOOTSTRAP_PROMPT.md
        \\Next step: paste that prompt into your coding agent so it scans the repo and builds the context vault properly.
        \\
    , .{cwd});
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

fn listSkills(allocator: std.mem.Allocator) !void {
    try runSkillsWithPreparedSource(
        allocator,
        ".",
        "npx -y skills@latest add \"$source_dir\" --list",
    );
}

fn installAction(args: Install.Args, opts: Install.Options) !void {
    const allocator = std.heap.smp_allocator;
    const cwd = targetDir(args.target);
    const make_backup = !opts.no_backup;

    try std.fs.cwd().makePath(cwd);
    try installAll(allocator, cwd);

    if (hasInstallArtifacts(cwd)) {
        try installSelectedDependencies(allocator, cwd);
        try writeProjectContextBootstrapPromptIfSelected(allocator, cwd);
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
