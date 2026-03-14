#!/usr/bin/env python3
"""
map-preview.py — Live preview tool for TRTD FFA map files.

Usage:
    python map-preview.py js/maps/map-ffa2.js

Watches the file for changes and redraws in real time.
Press R to force reload, Q or close window to quit.
Click to place/remove spawn points and print their coords.
"""

import sys, os, re, time, math
import pygame

# ── Config ────────────────────────────────────────────────────────
WORLD_W   = 2400
WORLD_H   = 1600
WIN_W     = 960    # preview window width
WIN_H     = int(WIN_W * WORLD_H / WORLD_W)
SCALE     = WIN_W / WORLD_W

BG_COL    = (6,   6,  15)
GRID_COL  = (14,  14, 36)
WALL_COL  = (48,  48, 160)
WALL_EDGE = (48,  48, 210)
SPAWN_COL = (0,   229, 255)
TEXT_COL  = (180, 180, 220)
HOVER_COL = (255, 255,  80)

# ── JS parser ─────────────────────────────────────────────────────

def parse_map(path):
    """Extract walls (segments or rects) and spawns from a JS map file."""
    try:
        with open(path, 'r') as f:
            src = f.read()
    except FileNotFoundError:
        return [], []

    walls  = []
    spawns = []

    # ── Segment walls {x1,y1,x2,y2} ─────────────────────────────
    seg_pat = re.compile(
        r'\{[^}]*x1\s*:\s*([\-\d.]+)[^}]*y1\s*:\s*([\-\d.]+)'
        r'[^}]*x2\s*:\s*([\-\d.]+)[^}]*y2\s*:\s*([\-\d.]+)[^}]*\}'
    )
    for m in seg_pat.finditer(src):
        x1,y1,x2,y2 = float(m.group(1)),float(m.group(2)),float(m.group(3)),float(m.group(4))
        walls.append(('seg', x1, y1, x2, y2))

    # ── Rect walls {x,y,w,h} (only if no segments found) ─────────
    if not walls:
        rect_pat = re.compile(
            r'\{[^}]*\bx\s*:\s*([\-\d.]+)[^}]*\by\s*:\s*([\-\d.]+)'
            r'[^}]*\bw\s*:\s*([\-\d.]+)[^}]*\bh\s*:\s*([\-\d.]+)[^}]*\}'
        )
        for m in rect_pat.finditer(src):
            x,y,w,h = float(m.group(1)),float(m.group(2)),float(m.group(3)),float(m.group(4))
            walls.append(('rect', x, y, w, h))

    # ── Spawns {x:..., y:...} ─────────────────────────────────────
    sp_pat = re.compile(r'\{[^}]*\bx\s*:\s*([\d.]+)[^}]*\by\s*:\s*([\d.]+)[^}]*\}')
    # Heuristic: spawns section is usually before 'get walls'
    spawn_section = src
    walls_idx = src.find('get walls')
    if walls_idx > 0:
        spawn_section = src[:walls_idx]
    for m in sp_pat.finditer(spawn_section):
        x, y = float(m.group(1)), float(m.group(2))
        # Filter out obvious non-spawn numbers (tiny coords, huge coords)
        if 50 < x < WORLD_W-50 and 50 < y < WORLD_H-50:
            spawns.append((x, y))

    return walls, spawns


def w2s(x, y):
    """World coords → screen coords."""
    return int(x * SCALE), int(y * SCALE)


def draw_grid(surf):
    step = int(80 * SCALE)
    for x in range(0, WIN_W, step):
        pygame.draw.line(surf, GRID_COL, (x,0), (x, WIN_H))
    for y in range(0, WIN_H, step):
        pygame.draw.line(surf, GRID_COL, (0,y), (WIN_W, y))


def draw_walls(surf, walls):
    for wall in walls:
        if wall[0] == 'seg':
            _, x1, y1, x2, y2 = wall
            pygame.draw.line(surf, WALL_COL,  w2s(x1,y1), w2s(x2,y2), 8)
            pygame.draw.line(surf, WALL_EDGE, w2s(x1,y1), w2s(x2,y2), 1)
        else:
            _, x, y, w, h = wall
            rect = pygame.Rect(int(x*SCALE), int(y*SCALE), max(1,int(w*SCALE)), max(1,int(h*SCALE)))
            pygame.draw.rect(surf, WALL_COL,  rect)
            pygame.draw.rect(surf, WALL_EDGE, rect, 1)


def draw_spawns(surf, spawns):
    r = max(2, int(32 * SCALE))
    for sx, sy in spawns:
        px, py = w2s(sx, sy)
        pygame.draw.circle(surf, SPAWN_COL, (px,py), r, 1)
        pygame.draw.circle(surf, SPAWN_COL, (px,py), 3)


def draw_crosshair(surf, mx, my):
    """Show world coordinates at mouse position."""
    wx = mx / SCALE
    wy = my / SCALE
    pygame.draw.line(surf, HOVER_COL, (mx-10,my), (mx+10,my), 1)
    pygame.draw.line(surf, HOVER_COL, (mx,my-10), (mx,my+10), 1)
    return wx, wy


def draw_ui(surf, font, path, wall_count, spawn_count, wx, wy, last_reload, fps):
    lines = [
        f"File: {os.path.basename(path)}",
        f"Walls: {wall_count}   Spawns: {spawn_count}",
        f"Mouse: ({int(wx)}, {int(wy)})",
        f"FPS: {fps:.0f}  |  Last reload: {last_reload}",
        "R=reload  Q=quit  Click=print coord",
    ]
    y = 6
    for line in lines:
        surf.blit(font.render(line, True, TEXT_COL), (6, y))
        y += 16


def main():
    if len(sys.argv) < 2:
        print("Usage: python map-preview.py <path-to-map.js>")
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)

    pygame.init()
    screen = pygame.display.set_mode((WIN_W, WIN_H))
    pygame.display.set_caption(f"Map Preview — {os.path.basename(path)}")
    clock  = pygame.time.Clock()
    font   = pygame.font.SysFont('monospace', 13)

    walls, spawns = parse_map(path)
    last_mtime    = os.path.getmtime(path)
    last_reload   = time.strftime('%H:%M:%S')

    running = True
    while running:
        mx, my = pygame.mouse.get_pos()
        wx, wy = mx / SCALE, my / SCALE

        # ── Auto-reload on file change ────────────────────────────
        try:
            mtime = os.path.getmtime(path)
            if mtime != last_mtime:
                walls, spawns = parse_map(path)
                last_mtime  = mtime
                last_reload = time.strftime('%H:%M:%S')
        except OSError:
            pass

        # ── Events ───────────────────────────────────────────────
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_q, pygame.K_ESCAPE):
                    running = False
                elif event.key == pygame.K_r:
                    walls, spawns = parse_map(path)
                    last_reload = time.strftime('%H:%M:%S')
            elif event.type == pygame.MOUSEBUTTONDOWN:
                print(f"  {{x: {int(wx)},  y: {int(wy)}}},")

        # ── Draw ─────────────────────────────────────────────────
        screen.fill(BG_COL)
        draw_grid(screen)
        draw_walls(screen, walls)
        draw_spawns(screen, spawns)
        draw_crosshair(screen, mx, my)
        draw_ui(screen, font, path, len(walls), len(spawns), wx, wy,
                last_reload, clock.get_fps())

        pygame.display.flip()
        clock.tick(60)

    pygame.quit()


if __name__ == '__main__':
    main()
