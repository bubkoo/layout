use crate::{layout::Layout, util::*};

use itertools::izip;

pub fn apply_gravity_force2<T: Coord + std::fmt::Debug>(layout: &mut Layout<T>) {
    let center = &layout.settings.center;
    let gf = layout.settings.kg.clone();
    for (mass, pos, speed) in izip!(
        layout.masses.iter(),
        layout.points.iter(),
        layout.speeds.iter_mut()
    ) {

        for ((index, speed), pos) in speed.iter_mut().enumerate().zip(pos.iter()) {
            unsafe {
                *speed -= gf.clone() * (pos.clone() - center.get_unchecked(index).clone()) / mass.clone();    
            }
        }
    }
}

pub fn apply_gravity_fruchterman<T: Coord + std::fmt::Debug>(layout: &mut Layout<T>) {
    let center = &layout.settings.center;
    // 0.01 * k * g
    let gf = T::from(0.01).unwrap_or_else(T::zero) * layout.settings.ka.clone() * layout.settings.kg.clone();
    for (pos, speed) in izip!(
        layout.points.iter(),
        layout.speeds.iter_mut()
    ) {
        for ((index, speed), pos) in speed.iter_mut().enumerate().zip(pos.iter()) {
            unsafe {*speed -= gf.clone() * (pos.clone() - center.get_unchecked(index).clone())};
        }
    }
}

pub fn apply_gravity_forceatlas2<T: Coord + std::fmt::Debug>(layout: &mut Layout<T>) {
    let center = &layout.settings.center;
    for (mass, pos, speed) in izip!(
        layout.masses.iter(),
        layout.points.iter(),
        layout.speeds.iter_mut()
    ) {
        let d = norm(pos);
        if d.is_zero() {
            continue;
        }
        let f = (mass.clone() + T::one()) * layout.settings.kg.clone() / d;
        for ((index, speed), pos) in speed.iter_mut().enumerate().zip(pos.iter()) {
            unsafe {*speed -= f.clone() * (pos.clone() - center.get_unchecked(index).clone())};
        }
    }
}

pub fn apply_gravity_forceatlas2_sg<T: Coord + std::fmt::Debug>(layout: &mut Layout<T>) {
    let center = &layout.settings.center;
    for (mass, pos, speed) in izip!(
        layout.masses.iter(),
        layout.points.iter(),
        layout.speeds.iter_mut()
    ) {
        let f = (mass.clone() + T::one()) * layout.settings.kg.clone();
        for ((index, speed), pos) in speed.iter_mut().enumerate().zip(pos.iter()) {
            unsafe {*speed -= f.clone() * (pos.clone() - center.get_unchecked(index).clone())};
        }
    }
}