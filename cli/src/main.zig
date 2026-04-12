const std = @import("std");
const zeke = @import("zeke");

const repo_source = "Nairon-AI/agentic-starter-pack";
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

fn hasInstallArtifacts(cwd: []const u8) bool {
    var dir = std.fs.cwd().openDir(cwd, .{ .access_sub_paths = true }) catch return false;
    defer dir.close();

    dir.access("skills-lock.json", .{}) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return false,
    };
    if (dir.access("skills-lock.json", .{})) |_| return true else |_| {}

    dir.access("skills", .{}) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return false,
    };
    if (dir.access("skills", .{})) |_| return true else |_| {}

    dir.access(".agents/skills", .{}) catch |err| switch (err) {
        error.FileNotFound => return false,
        else => return false,
    };
    return true;
}

fn installAll(allocator: std.mem.Allocator, cwd: []const u8) !void {
    const argv = [_][]const u8{
        "npx",
        "-y",
        "skills@latest",
        "add",
        repo_source,
        "--all",
        "-y",
    };
    try runCommand(allocator, &argv, cwd);
}

fn installChoose(allocator: std.mem.Allocator, cwd: []const u8) !void {
    const argv = [_][]const u8{
        "npx",
        "-y",
        "skills@latest",
        "add",
        repo_source,
    };
    try runCommand(allocator, &argv, cwd);
}

fn listSkills(allocator: std.mem.Allocator) !void {
    const argv = [_][]const u8{
        "npx",
        "-y",
        "skills@latest",
        "add",
        repo_source,
        "--list",
    };
    try runCommand(allocator, &argv, ".");
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
