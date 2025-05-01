---
description: >-
  Introduces 6D rotation representation, a continuous method for parameterizing
  3D rotations that is better for neural network to learn.
---

# 6D Rotation Representation

**Keypoints**

* **Drop the last column vector** of the 3D rotation matrix to obtain the 6D rotation representation.
* The resulting 6D matrix lies in a Stiefel manifold, which is **continuous**.
* The rotation matrix is a orthogonal matrix, so if a column vector is dropped, it can be **recovered**.
* The last column vector can be recovered with cross product for 3D rotation matrix or Gram-Schmidt process for generalized rotation matrices.

## Introduction

The 6D rotation is a representation of 3D rotation matrix introduced in the paper\[1]. It features a **continuous** representation of rotation, and experiments showed it is **better for neural network to learn**, compared to commonly used Euler angles, axis-angle, and quaternion representations.

### **Intuition**

A rotation matrix is an orthogonal matrix, which means its column vectors are normalized and orthogonal to each other. We can drop one of the column vectors and later recover it, since its direction must be orthogonal to all the other vectors and its length is must be one.

<details>

<summary><strong>Orthogonal Matrix</strong></summary>

* Normalized vector: a vector with unit-length

- Orthogonal vectors: vectors that are perpendicular to each other

* Orthonormal vectors: vectors that are both normalized and orthogonal

- Orthogonal matrix: a matrix where every column vector is orthonormal

</details>

**Visualizing**

If this concept seems abstract, try to imaging in this way: Imagine each column vector of a rotation matrix as an axis in a 3D coordinate system (like the x, y, and z axes). Since each column vector is normalized and orthogonal to the others, they form a coordinate frame. When we drop one axis (column vector), we can still determine exactly where it should be. It has to be perpendicular to the remaining axes and have unit length.

### **Continuity**

Note that the dropped rotation matrix lies in a Stiefel manifold, so its is continuous. (for more detailed, please refer to the original paper\[1].)

## **Computation**

Consider a 3D rotation matrix $$\mathbf R \in \R^{3\times 3}$$ with columns vectors $$\bm a, \bm b, \bm c$$:

$$
\mathbf R = [
\bm a, \bm b, \bm c
]
$$

To compute the 6D rotation representation, simply drop the last column vector:

$$
\mathbf R_{6D} = [\bm a, \bm b]
$$

### **Cross Product Method**

To recover the 3D rotation matrix, we can utilize **cross product** to find the direction orthogonal to the other vectors and then **normalized** it:

$$
\bm {\hat{c}} = \text{normalize}(\bm a \times \bm b)
$$

This method is straightforward. However, the vectors $$\bm a$$ and $$\bm b$$ we begin with may not be perfectly orthonormal. We also need to ensure they are orthonormal to obtain a valid rotation matrix $$\hat{\bm R}$$.

$$
\begin{aligned}
\hat{\bm a} &= \text{normalize}(\bm a)
\\
\hat{\bm c} &= \text{normalize}(\hat{\bm a} \times \bm b)
\\
\hat{\bm b} &= \text{normalize}(\hat{\bm c} \times \hat{\bm a})
\end{aligned}
$$

$$
\hat{\mathbf R} = [\hat{\bm a}, \hat{\bm b}, \hat{\bm c}]
$$

<details>

<summary>Implementation of Cross Product Method</summary>

{% code fullWidth="true" %}
```python
import numpy as np
from scipy.spatial.transform import Rotation

# Generate a random 3D rotation matrix
R = Rotation.random().as_matrix()

a = R[:, 0]
b = R[:, 1]
c = R[:, 2]

# Ensure a is normalized
a_hat = a / np.linalg.norm(a, ord=2)
# Ensure c is orthonormal
c_cross = np.cross(a, b)
c_hat = c_cross / np.linalg.norm(c_cross, ord=2)
# Ensure b is orthonormal to others
b_cross = np.cross(c_hat, a)
b_hat = b_cross / np.linalg.norm(b_cross, ord=2)

ab_inner = np.inner(a_hat, b_hat)
ac_inner = np.inner(a_hat, c_hat)
bc_inner = np.inner(b_hat, c_hat)
assert np.isclose(ab_inner, 0) , f'a and b_hat is not orthogoal, {ab_inner=}'
assert np.isclose(ac_inner, 0) , f'a and c_hat is not orthogoal, {ac_inner=}'
assert np.isclose(bc_inner, 0) , f'b_hat and c_hat is not orthogoal, {bc_inner=}'
assert np.linalg.norm(a_hat) == np.linalg.norm(b_hat) == np.linalg.norm(c_hat) == 1, \
  f'some vectors are not unit_length'
```
{% endcode %}



</details>

### **Gram-Schmidt  Process**

The Gram-Schmidt process is a generalized method for orthogonalization. It transforms a set of vectors with arbitrary dimensions into orthonormal vectors.

Given a set of vectors $$\bm v_1, \dots, \bm v_n \in \R^n$$, it first constructs orthogonal vectors iteratively by removing components that are not orthogonal to previously orthogonalized vectors. This produces a set of orthogonal vectors $$\bm u_1, \dots, \bm u_n$$.

$$
\bm u_i = \bm v_i - \sum_{j=1}^{i-1} (\frac{\bm v_i \cdot \bm u_j}{\bm u_j \cdot \bm u_j}) \bm u_j
$$

where $$\cdot$$ denotes the inner product.

Then, it normalizes all of them to obtain orthonormal vectors $$\bm e_1, \dots, \bm e_n$$ and constructs the rotation matrix $$\hat {\mathbf R}$$.

$$
\bm e_i = \frac{\bm u_i}{\| \bm u_i \|_2}\hat{\mathbf R} = [\bm e_1, \dots, \bm e_n]
$$

## Non-uniqueness

The 6D representation could be not unique\[2,3] when the remaining column vectors are not derived from a valid rotation matrix. For example, they may not be perfectly orthogonal to each other or may not have unit-length.

The non-uniqueness happens during the orthogonalization process, since many invalid representations could be corrected to the same rotation matrix.

**In Practical**

In practical, this is not a major concern, since it corrects the imperfect output of the neural network and provides smooth optimization, which can be beneficial to work with neural networks.

## **Further Reading**

* The original paper\[1] generalizes to $$n$$-dimensional rotation matrices, whose representation is an $$n \times (n-1)$$ matrix.
* **Stiefel manifold** ensures the continuity of this representation.

## References

1. Zhou et al., “On the Continuity of Rotation Representations in Neural Networks,” CVPR, 2019. \[[arxiv](https://arxiv.org/abs/1812.07035), [page](https://zhouyisjtu.github.io/project_rotation/rotation.html)]
2. PyTorch3D doc: [`pytorch3d.transforms.matrix_to_rotation_6d`](https://pytorch3d.readthedocs.io/en/latest/modules/transforms.html#pytorch3d.transforms.matrix_to_rotation_6d)
3. GitHub Issue: [What is meant with non-unique 6D representations?](https://github.com/facebookresearch/pytorch3d/issues/1620)
