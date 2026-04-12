const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const zeke_mod = b.addModule("zeke", .{
        .root_source_file = b.path("vendor/zeke/src/root.zig"),
    });

    const cli_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    cli_mod.addImport("zeke", zeke_mod);

    const exe = b.addExecutable(.{
        .name = "nairon-skills",
        .root_module = cli_mod,
    });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the Nairon skills CLI");
    run_step.dependOn(&run_cmd.step);
}
