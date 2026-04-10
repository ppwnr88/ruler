use wasm_bindgen::prelude::*;
use web_sys::{CanvasRenderingContext2d, HtmlCanvasElement};

// Piliapp-style ruler palette — khaki yellow body, black markings
// Background sampled from piliapp default-lside.png (#F0E68C = CSS "khaki")
const COLOR_TICK:   &str = "#333333";  // dark gray ticks (slightly softer than pure black)
const COLOR_TEXT:   &str = "#111111";  // near-black labels
const COLOR_MARKER: &str = "#CC2200";  // red marker line (stands out on yellow)
const COLOR_CURSOR: &str = "#0055BB";  // blue cursor line
const COLOR_BORDER: &str = "#BFB86A";  // muted golden border
const COLOR_ZERO:   &str = "#000000";  // pure black for 0 origin line

#[derive(Clone, Copy, PartialEq)]
enum Orientation {
    Horizontal,
    Vertical,
}

#[derive(Clone, Copy, PartialEq)]
enum Unit {
    Pixels,
    Centimeters,
    Inches,
}

#[wasm_bindgen]
pub struct Ruler {
    canvas: HtmlCanvasElement,
    ctx: CanvasRenderingContext2d,
    width: f64,
    height: f64,
    orientation: Orientation,
    unit: Unit,
    ppi: f64,
    /// ruler-pixel value at canvas position 0
    offset: f64,
    /// stored as ruler-pixel positions
    markers: Vec<f64>,
    thickness: f64,
    fraction_denom: u32,
    cursor_pos: f64,
}

#[wasm_bindgen]
impl Ruler {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str) -> Result<Ruler, JsValue> {
        console_error_panic_hook::set_once();

        let window = web_sys::window().ok_or_else(|| JsValue::from_str("no window"))?;
        let document = window.document().ok_or_else(|| JsValue::from_str("no document"))?;

        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str(&format!("element #{} not found", canvas_id)))?
            .dyn_into::<HtmlCanvasElement>()?;

        let ctx = canvas
            .get_context("2d")?
            .ok_or_else(|| JsValue::from_str("failed to get 2d context"))?
            .dyn_into::<CanvasRenderingContext2d>()?;

        let w = canvas.width() as f64;
        let h = canvas.height() as f64;

        Ok(Ruler {
            canvas,
            ctx,
            width: w,
            height: h,
            orientation: Orientation::Horizontal,
            unit: Unit::Centimeters,
            ppi: 96.0,
            offset: 0.0,
            markers: Vec::new(),
            thickness: 80.0,
            fraction_denom: 8,
            cursor_pos: -1.0,
        })
    }

    pub fn resize(&mut self, width: f64, height: f64) {
        self.width = width;
        self.height = height;
        self.canvas.set_width(width as u32);
        self.canvas.set_height(height as u32);
    }

    pub fn set_horizontal(&mut self) {
        self.orientation = Orientation::Horizontal;
    }
    pub fn set_vertical(&mut self) {
        self.orientation = Orientation::Vertical;
    }
    pub fn is_horizontal(&self) -> bool {
        self.orientation == Orientation::Horizontal
    }

    pub fn set_unit(&mut self, unit: &str) {
        self.unit = match unit {
            "px" => Unit::Pixels,
            "cm" => Unit::Centimeters,
            "in" => Unit::Inches,
            _ => Unit::Centimeters,
        };
    }
    pub fn get_unit(&self) -> String {
        match self.unit {
            Unit::Pixels => "px".into(),
            Unit::Centimeters => "cm".into(),
            Unit::Inches => "in".into(),
        }
    }

    pub fn get_ppi(&self) -> f64 {
        self.ppi
    }
    pub fn set_ppi(&mut self, ppi: f64) {
        self.ppi = ppi.clamp(50.0, 400.0);
    }

    pub fn get_offset(&self) -> f64 {
        self.offset
    }
    pub fn set_offset(&mut self, v: f64) {
        self.offset = v;
    }
    pub fn scroll(&mut self, delta: f64) {
        self.offset -= delta;
    }

    pub fn get_thickness(&self) -> f64 {
        self.thickness
    }
    pub fn set_thickness(&mut self, v: f64) {
        self.thickness = v.clamp(40.0, 200.0);
    }

    pub fn set_fraction_denom(&mut self, d: u32) {
        if matches!(d, 4 | 8 | 16 | 32) {
            self.fraction_denom = d;
        }
    }

    pub fn set_cursor(&mut self, pos: f64) {
        self.cursor_pos = pos;
    }
    pub fn hide_cursor(&mut self) {
        self.cursor_pos = -1.0;
    }

    /// Toggle a marker at canvas_pos. Returns true if marker was added, false if removed.
    pub fn toggle_marker(&mut self, canvas_pos: f64) -> bool {
        let ruler_px = canvas_pos - self.offset;
        if let Some(i) = self
            .markers
            .iter()
            .position(|&m| (m - ruler_px).abs() < 8.0)
        {
            self.markers.remove(i);
            false
        } else {
            self.markers.push(ruler_px);
            true
        }
    }

    pub fn clear_markers(&mut self) {
        self.markers.clear();
    }

    pub fn get_marker_count(&self) -> usize {
        self.markers.len()
    }

    pub fn get_marker_values(&self) -> Vec<f64> {
        self.markers
            .iter()
            .map(|&px| px / self.pixels_per_unit())
            .collect()
    }

    pub fn get_value_at(&self, canvas_pos: f64) -> f64 {
        (canvas_pos - self.offset) / self.pixels_per_unit()
    }

    /// Parse commands like "5 cm", "50 px", "2.5 in", "10 mm"
    pub fn parse_command(&self, cmd: &str) -> String {
        let parts: Vec<&str> = cmd.trim().split_whitespace().collect();
        if parts.len() < 2 {
            return "Usage: <number> <unit>  e.g. \"5 cm\"".into();
        }
        let value: f64 = match parts[0].parse() {
            Ok(v) => v,
            Err(_) => return format!("Invalid number: {}", parts[0]),
        };
        let src_unit = parts[1].to_lowercase();
        let pixels = match src_unit.as_str() {
            "px" | "pixels" => value,
            "cm" => value * self.ppi / 2.54,
            "mm" => value * self.ppi / 25.4,
            "in" | "inch" | "inches" => value * self.ppi,
            _ => return format!("Unknown unit: {} (use px, cm, mm, in)", src_unit),
        };
        let target_val = pixels / self.pixels_per_unit();
        let unit_str = self.get_unit();
        format!(
            "{} {} = {:.3} {}",
            value,
            src_unit,
            target_val,
            unit_str
        )
    }

    fn pixels_per_unit(&self) -> f64 {
        match self.unit {
            Unit::Pixels => 1.0,
            Unit::Centimeters => self.ppi / 2.54,
            Unit::Inches => self.ppi,
        }
    }

    fn tick_intervals(&self) -> (f64, f64, f64) {
        // (major, medium, minor) in unit values
        match self.unit {
            Unit::Pixels => (100.0, 50.0, 10.0),
            Unit::Centimeters => (1.0, 0.5, 0.1),
            Unit::Inches => {
                let minor = 1.0 / self.fraction_denom as f64;
                (1.0, 0.5, minor)
            }
        }
    }

    fn format_major_label(&self, i: i64, major_u: f64) -> String {
        let value = i as f64 * major_u;
        match self.unit {
            Unit::Pixels => format!("{}", value as i64),
            Unit::Centimeters => {
                if (value - value.round()).abs() < 0.001 {
                    format!("{}", value.round() as i64)
                } else {
                    format!("{:.1}", value)
                }
            }
            Unit::Inches => {
                if (value - value.round()).abs() < 0.001 {
                    let v = value.round() as i64;
                    if v == 0 {
                        "0".into()
                    } else {
                        format!("{}\"", v)
                    }
                } else {
                    String::new()
                }
            }
        }
    }

    pub fn draw(&self) {
        let ctx = &self.ctx;
        let is_h = self.orientation == Orientation::Horizontal;
        let main_dim = if is_h { self.width } else { self.height };
        let cross_dim = if is_h { self.height } else { self.width };
        let t = cross_dim.min(self.thickness);

        ctx.clear_rect(0.0, 0.0, self.width, self.height);

        // Gradient background: khaki #F5EE96 (top) → #E2D870 (bottom), 24 slices
        // Base color sampled from piliapp ruler image: #F0E68C
        let steps = 24i32;
        for i in 0..steps {
            let frac = i as f64 / steps as f64;
            let r = lerp(245.0, 226.0, frac) as u8;  // 0xF5 → 0xE2
            let g = lerp(238.0, 216.0, frac) as u8;  // 0xEE → 0xD8
            let b = lerp(150.0, 112.0, frac) as u8;  // 0x96 → 0x70
            ctx.set_fill_style_str(&format!("#{:02X}{:02X}{:02X}", r, g, b));
            let y0 = frac * t;
            let y1 = (frac + 1.0 / steps as f64) * t + 0.5;
            if is_h {
                ctx.fill_rect(0.0, y0, self.width, y1 - y0);
            } else {
                ctx.fill_rect(y0, 0.0, y1 - y0, self.height);
            }
        }

        let ppu = self.pixels_per_unit();
        let (major_u, medium_u, minor_u) = self.tick_intervals();
        let major_px = major_u * ppu;
        let medium_px = medium_u * ppu;
        let minor_px = minor_u * ppu;

        let major_h = t * 0.65;
        let medium_h = t * 0.40;
        let minor_h = t * 0.22;

        // Visible range in ruler-pixel space
        let v_start = -self.offset - major_px;
        let v_end = main_dim - self.offset + major_px;

        // Minor ticks
        if minor_px >= 2.5 {
            ctx.set_stroke_style_str(COLOR_TICK);
            ctx.set_line_width(0.8);
            let i0 = (v_start / minor_px).floor() as i64;
            let i1 = (v_end / minor_px).ceil() as i64;
            for i in i0..=i1 {
                let rp = i as f64 * minor_px;
                if near_multiple(rp, medium_px) || near_multiple(rp, major_px) {
                    continue;
                }
                let cp = rp + self.offset;
                if cp < 0.0 || cp > main_dim {
                    continue;
                }
                draw_tick(ctx, cp, t, minor_h, is_h);
            }
        }

        // Medium ticks
        if medium_px >= 4.0 {
            ctx.set_stroke_style_str(COLOR_TICK);
            ctx.set_line_width(1.0);
            let i0 = (v_start / medium_px).floor() as i64;
            let i1 = (v_end / medium_px).ceil() as i64;
            for i in i0..=i1 {
                let rp = i as f64 * medium_px;
                if near_multiple(rp, major_px) {
                    continue;
                }
                let cp = rp + self.offset;
                if cp < 0.0 || cp > main_dim {
                    continue;
                }
                draw_tick(ctx, cp, t, medium_h, is_h);
            }
        }

        // Major ticks + labels
        {
            let font_size = (t * 0.195).clamp(8.0, 13.0) as i32;
            ctx.set_font(&format!("bold {}px Arial, Helvetica, sans-serif", font_size));
            ctx.set_text_align("left");
            ctx.set_text_baseline("top");

            let i0 = (v_start / major_px).floor() as i64;
            let i1 = (v_end / major_px).ceil() as i64;
            for i in i0..=i1 {
                let rp = i as f64 * major_px;
                let cp = rp + self.offset;

                // Zero line: full-height, darker
                if i == 0 {
                    ctx.set_stroke_style_str(COLOR_ZERO);
                    ctx.set_line_width(2.0);
                    ctx.begin_path();
                    if is_h {
                        ctx.move_to(cp, 0.0);
                        ctx.line_to(cp, t);
                    } else {
                        ctx.move_to(0.0, cp);
                        ctx.line_to(t, cp);
                    }
                    ctx.stroke();
                }

                if cp < -2.0 || cp > main_dim + 2.0 {
                    continue;
                }

                ctx.set_stroke_style_str(COLOR_TICK);
                ctx.set_line_width(1.5);
                draw_tick(ctx, cp, t, major_h, is_h);

                // Label
                let label = self.format_major_label(i, major_u);
                if !label.is_empty() && major_px >= 18.0 {
                    ctx.set_fill_style_str(COLOR_TEXT);
                    if is_h {
                        let _ = ctx.fill_text(&label, cp + 3.0, 3.0);
                    } else {
                        ctx.save();
                        let _ = ctx.translate(3.0, cp - 2.0);
                        let _ = ctx.rotate(-std::f64::consts::FRAC_PI_2);
                        let _ = ctx.fill_text(&label, 0.0, 0.0);
                        ctx.restore();
                    }
                }
            }
        }

        // Markers
        for &ruler_px in &self.markers {
            let cp = ruler_px + self.offset;
            if cp < -8.0 || cp > main_dim + 8.0 {
                continue;
            }
            ctx.set_stroke_style_str(COLOR_MARKER);
            ctx.set_line_width(1.5);
            ctx.begin_path();
            if is_h {
                ctx.move_to(cp, 0.0);
                ctx.line_to(cp, t);
            } else {
                ctx.move_to(0.0, cp);
                ctx.line_to(t, cp);
            }
            ctx.stroke();

            // Triangle pointer at the top/left edge
            ctx.set_fill_style_str(COLOR_MARKER);
            ctx.begin_path();
            if is_h {
                ctx.move_to(cp - 5.0, 0.0);
                ctx.line_to(cp + 5.0, 0.0);
                ctx.line_to(cp, 11.0);
            } else {
                ctx.move_to(0.0, cp - 5.0);
                ctx.line_to(0.0, cp + 5.0);
                ctx.line_to(11.0, cp);
            }
            ctx.close_path();
            let _ = ctx.fill();
        }

        // Cursor line
        if self.cursor_pos >= 0.0 {
            ctx.set_stroke_style_str(COLOR_CURSOR);
            ctx.set_line_width(1.0);
            ctx.begin_path();
            if is_h {
                ctx.move_to(self.cursor_pos, 0.0);
                ctx.line_to(self.cursor_pos, t);
            } else {
                ctx.move_to(0.0, self.cursor_pos);
                ctx.line_to(t, self.cursor_pos);
            }
            ctx.stroke();
        }

        // Borders
        ctx.set_stroke_style_str(COLOR_BORDER);
        ctx.set_line_width(1.5);
        ctx.begin_path();
        if is_h {
            ctx.move_to(0.0, 0.0);
            ctx.line_to(self.width, 0.0);
            ctx.move_to(0.0, t);
            ctx.line_to(self.width, t);
        } else {
            ctx.move_to(0.0, 0.0);
            ctx.line_to(0.0, self.height);
            ctx.move_to(t, 0.0);
            ctx.line_to(t, self.height);
        }
        ctx.stroke();
    }
}

fn draw_tick(ctx: &CanvasRenderingContext2d, pos: f64, thickness: f64, tick_h: f64, is_h: bool) {
    ctx.begin_path();
    if is_h {
        ctx.move_to(pos, thickness);
        ctx.line_to(pos, thickness - tick_h);
    } else {
        ctx.move_to(thickness, pos);
        ctx.line_to(thickness - tick_h, pos);
    }
    ctx.stroke();
}

fn near_multiple(value: f64, multiple: f64) -> bool {
    let r = (value / multiple).fract().abs();
    r < 0.001 || r > 0.999
}

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}
