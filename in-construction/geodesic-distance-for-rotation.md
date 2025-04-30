---
description: >-
  Introduces the concept of geodesic distance for measuring rotation
  differences.
---

# Geodesic Distance for Rotation

The **L2 distance** on the rotation is **discontinuous**. Think of it as a proper distance between two cities on the Earth is a curve line follow the curvature of the Earth. The L2 distance express a straight line that go through the underground. The proper way to measure this curved line is called “Geodesic distance”. The distance between two rotations also follow the same idea.

To compute the **geodesic loss**, we can use the relationship between the trace of a rotation matrix $$\text{tr}(\mathbf R)$$ and its rotation angle $$\theta$$.

$$
\text{tr}(\mathbf R) = 1 + 2 \cos (\theta)
$$

Thus, the **geodesic distance** between two rotations $$\mathbf R_s$$ and $$\mathbf R_t$$ is

$$
L_{geo} = \arccos(\frac{\text{tr}(\mathbf R_s \mathbf R_t^T) - 1}{2})
$$

**Implementation Details**

*   **Numerical stability**

    To prevent invalid input of $$\arccos$$, we usually clamp the input to $$[-1+\epsilon, 1-\epsilon]$$.
*   **Squared geodesic loss**

    This appears to be a valid method for smoothing loss at small values, but I haven't examined it further.
