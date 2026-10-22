# Make your first adventure scene

The workshop opens the study/hall sample, or your saved project. Choose **Playtest** to explore it, or **New project** to start with the supplied explorer and a floor you can customize.

## Set up a room and character

1. Give the game an **Adventure title** and the room a **Room name**. The inspector scrolls independently, so additional tools are below the room settings.
2. Choose **Import background** or **Replace background**. PNG, JPEG, and WebP images can be up to 8 MB and 4096 × 4096 pixels. Images fit the room dimensions. Replacing a background keeps other library assets and rooms intact.
3. Use **Ground** or **Draw ground** to draw green walkable rectangles. Overlapping green areas connect. Use **Obstacle** or **Draw obstacle** to mark red rectangles the character's feet cannot cross. Select a shape from **Scene setup** to edit its exact bounds or delete it.
4. Choose **Place character**, then click the desired feet position on walkable ground. This updates the room's starting entrance. Adjust that entrance's position/facing in the inspector as needed.
5. Under **Playable character**, set the character's name, speed, height, and feet anchor. The supplied explorer already has idle/walk/talk animations. To use other artwork, import a sprite sheet through **Asset library**, open each animation mapping, and choose the image, frame size, first frame, frame count, and speed. Frame numbers start at zero and progress left-to-right, then down the sheet.

Navigation currently uses rectangles and treats the feet as a point. Leave enough clearance around obstacles for the artwork; do not rely on the sprite's visible body to collide automatically. If you change room dimensions, also check its ground, objects, and entrances fit the new size.

## Add objects and artwork

1. Choose **Draw hotspot**, then drag around an object. Or choose **Add object** and edit its bounds in the inspector.
2. Set **Object name** and **When inspected**. This response is what the protagonist says when the player chooses **View**.
3. Choose **Place approach point**, then click where the character should stand to reach the object. Keep it on walkable ground. The gold marker is separate from the object's click bounds; a cabinet's center is usually not a suitable place to stand.
4. To place additional artwork, select an image in **Asset library** and choose **Add image layer**. Set its position, size, and whether it appears behind or in front of the character. Referenced images cannot be deleted until their room/layer/animation uses are removed or changed.

## Connect rooms

1. Choose **Add room**, name it, and configure its background, ground, and starting entrance.
2. Return to the original room and choose **Exit** or **Draw exit**. Draw the clickable exit area.
3. Name the exit, set its approach point, and choose **Destination room** and **Destination entrance**. Add additional entrances if the destination needs distinct arrival positions.
4. Add a return exit in the other room. The player must reach an exit's approach point before the transition occurs.

**Starting room** selects where a new playtest/game begins. Choosing a room in the editor does not change the game's starting room. Duplicating a room creates independent local objects; deleting a room clears exits that pointed to it so you can reconnect them. Undo can restore edits.

## Playtest, save, and export

- **Walk to** is the default. Click the ground to walk. Clicking an object walks to its approach point without operating it.
- Select **View**, then an object, to hear the protagonist's observation without walking. The displayed quick View action and secondary click provide shortcuts in Walk mode.
- Use **Cancel** or Escape to stop a walk or clear the selected action. A new destination replaces the old walk. **Restart** begins a clean playtest; **Edit scene** returns to authoring.
- For keyboard movement, Tab to the scene, position the visible destination marker with arrow keys, and press Enter. Objects, exits, and controls also support focus and activation.
- Use **Undo** and **Redo** to recover edits. Issue messages navigate to affected fields. Unfinished character/ground/exit setup blocks play/export but can still be saved as a draft. Invalid data or broken references must be corrected before saving.
- **Save project** keeps the project in this browser; **Reopen saved** restores the last successful save. **Download backup** creates an editable copy; **Open backup** restores one. Browser storage can fill up or be cleared, so keep a downloaded backup.
- **Export game** downloads a playable ZIP. Extract it, serve the complete folder on static HTTP hosting, and open its `index.html` URL. Direct opening from disk is not supported. Export does not publish anything publicly.

## Open an older project

An M0 backup opens as an editable draft with its artwork, object identities, and observation text preserved. Choose **Use starter character**, draw walkable ground, and check the starting entrance before playtesting. Configure object approach points to make walking to them work. The app explains missing setup; it does not silently invent the scene's navigation or character. Saving in this version keeps an original older browser save separately. Imported backup files are unchanged.

The current version supports exploration and View. Inventory, pickup/use/give effects, additional physical verbs, full conversations, and player saves are the next stages. **Test sound** currently plays only a diagnostic tone.
