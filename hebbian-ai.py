import numpy as np
import pygame
import random
from ai_bot import AI_Bot  # Import AI_Bot

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Game parameters
WORLD_SIZE = 100
CELL_SIZE = 5
VISION_SIZE = 7  # Increased vision size
BOT_VISION_RANGE = VISION_SIZE // 2
REWARD_AMOUNT = 400

# Initialize Pygame and game world
pygame.init()
screen = pygame.display.set_mode((1200, 600))
pygame.display.set_caption('AI Bot Training Ground')
world = np.zeros((WORLD_SIZE, WORLD_SIZE))

# Spawn rewards randomly
for _ in range(REWARD_AMOUNT):
    x = random.randint(0, WORLD_SIZE - 1)
    y = random.randint(0, WORLD_SIZE - 1)
    world[y, x] = 1

# Initialize bot position
bot_x = 1
bot_y = 1

# Initialize AI bot
ai_bot = AI_Bot(VISION_SIZE)

# Game loop
running = True
clock = pygame.time.Clock()

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # Get bot's vision
    vision = np.zeros((VISION_SIZE, VISION_SIZE))
    for i in range(VISION_SIZE):
        for j in range(VISION_SIZE):
            world_y = (bot_y - BOT_VISION_RANGE + i) % WORLD_SIZE
            world_x = (bot_x - BOT_VISION_RANGE + j) % WORLD_SIZE
            vision[i, j] = world[world_y, world_x]

    vision_flat = vision.flatten()

    # Check for reward at current position
    reward = world[bot_y, bot_x]
    if reward == 1:
        # Remove collected reward
        world[bot_y, bot_x] = 0

        # Spawn new reward
        while True:
            new_x = random.randint(0, WORLD_SIZE - 1)
            new_y = random.randint(0, WORLD_SIZE - 1)
            if world[new_y, new_x] == 0:
                world[new_y, new_x] = 1
                break
    else:
        reward = 0

    # Get movement from AI bot
    movement = ai_bot.choose_action(vision_flat, reward)

    # Update bot position based on movement
    if movement == 0:  # Up
        bot_y = (bot_y - 1) % WORLD_SIZE
    elif movement == 1:  # Down
        bot_y = (bot_y + 1) % WORLD_SIZE
    elif movement == 2:  # Left
        bot_x = (bot_x - 1) % WORLD_SIZE
    elif movement == 3:  # Right
        bot_x = (bot_x + 1) % WORLD_SIZE

    # Clear screen
    screen.fill(BLACK)

    # Draw world (left side)
    world_surface = pygame.Surface((WORLD_SIZE * CELL_SIZE, WORLD_SIZE * CELL_SIZE))
    world_surface.fill(BLACK)

    # Draw rewards
    reward_positions = np.argwhere(world == 1)
    for y, x in reward_positions:
        pygame.draw.rect(world_surface, GREEN, (x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE))

    # Draw bot
    pygame.draw.rect(world_surface, RED, (bot_x * CELL_SIZE, bot_y * CELL_SIZE, CELL_SIZE, CELL_SIZE))

    # Draw vision field
    for i in range(VISION_SIZE):
        for j in range(VISION_SIZE):
            world_y = (bot_y - BOT_VISION_RANGE + i) % WORLD_SIZE
            world_x = (bot_x - BOT_VISION_RANGE + j) % WORLD_SIZE
            pygame.draw.rect(world_surface, BLUE, (world_x * CELL_SIZE, world_y * CELL_SIZE, CELL_SIZE, CELL_SIZE), 1)

    screen.blit(world_surface, (50, 50))

    # Draw neural network visualization using AI bot's method
    ai_bot.draw_neural_network(screen, vision)

    pygame.display.flip()
    clock.tick(10)

pygame.quit()
