# Tavi garment silhouette

Tavi is a geometric character. Preserve the central clothing design instead of
adding deformation just to imitate realistic cloth.

The approved base retains its original length (74u below the waistband), waist,
flare width, and rounded outline. Tuck the knee bend into depth while preserving
high lifts, foot/calf travel, alternating step order, and locomotion's energy.
The garment stays fixed around that authored motion.

The skirt keeps the same rounded bell contour in standing, walking, sprinting,
skipping, climbing, and ordinary turns. Carry it from the waist and pelvis;
individual thigh bends must not pull the hem sideways, split it into shorts,
widen it into an apron, or change its volume. Shirt/waist overlap stays fitted.

Use a separate, restrained corrective only when a pose needs it to fit or make
contact: ledge sitting and cross-legged ground sitting are current examples.
Preserve the garment's proportions, curved outline, coverage, and visual weight
even in those exceptions. These are authored pose shapes, not cloth simulation.

The isolated Rive lab implements this policy; the original production fallback
is retained. Review significant silhouette changes with the user before adopting
them. `check_skirt_design.py` locks ordinary-motion contour and skin ownership.
