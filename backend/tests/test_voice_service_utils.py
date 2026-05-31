import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.voice_service_utils import (
    validate_audio_format,
    validate_audio_size,
    assert_valid_audio,
    get_supported_formats,
    estimate_bitrate_kbps,
    UnsupportedFormatError,
    AudioTooLargeError,
    AudioValidationError,
    MAX_AUDIO_SECONDS,
    SUPPORTED_FORMATS,
    DEFAULT_MAX_MB
)


class TestConstants:
    def test_max_audio_seconds(self):
        assert MAX_AUDIO_SECONDS == 120

    def test_default_max_mb(self):
        assert DEFAULT_MAX_MB == 25

    def test_supported_formats(self):
        assert '.wav' in SUPPORTED_FORMATS
        assert '.webm' in SUPPORTED_FORMATS
        assert '.mp3' in SUPPORTED_FORMATS
        assert '.ogg' in SUPPORTED_FORMATS
        assert '.mp4' in SUPPORTED_FORMATS
        assert '.m4a' in SUPPORTED_FORMATS


class TestValidateAudioFormat:
    def test_valid_wav_format(self):
        assert validate_audio_format("recording.wav") is True

    def test_valid_webm_format(self):
        assert validate_audio_format("audio.webm") is True

    def test_valid_mp3_format(self):
        assert validate_audio_format("sound.mp3") is True

    def test_valid_ogg_format(self):
        assert validate_audio_format("voice.ogg") is True

    def test_valid_mp4_format(self):
        assert validate_audio_format("video.mp4") is True

    def test_valid_m4a_format(self):
        assert validate_audio_format("audio.m4a") is True

    def test_case_insensitive(self):
        assert validate_audio_format("RECORDING.WAV") is True
        assert validate_audio_format("Audio.MP3") is True

    def test_invalid_format_pdf(self):
        assert validate_audio_format("document.pdf") is False

    def test_invalid_format_txt(self):
        assert validate_audio_format("notes.txt") is False

    def test_invalid_format_no_extension(self):
        assert validate_audio_format("audiofile") is False


class TestValidateAudioSize:
    def test_small_file_within_limit(self):
        small_data = b"x" * (1 * 1024 * 1024)
        assert validate_audio_size(small_data, max_mb=25) is True

    def test_large_file_exceeds_limit(self):
        large_data = b"x" * (26 * 1024 * 1024)
        assert validate_audio_size(large_data, max_mb=25) is False

    def test_exactly_at_limit(self):
        exact_data = b"x" * (25 * 1024 * 1024)
        assert validate_audio_size(exact_data, max_mb=25) is True

    def test_bytearray_accepted(self):
        data = bytearray(b"x" * (1 * 1024 * 1024))
        assert validate_audio_size(data, max_mb=25) is True


class TestAssertValidAudio:
    def test_valid_audio_no_exception(self):
        assert_valid_audio("recording.wav", b"x" * (1 * 1024 * 1024)) is None

    def test_invalid_format_raises(self):
        with pytest.raises(UnsupportedFormatError) as exc_info:
            assert_valid_audio("document.pdf", b"x" * 1000)
        assert ".pdf" in str(exc_info.value)

    def test_too_large_raises(self):
        with pytest.raises(AudioTooLargeError) as exc_info:
            assert_valid_audio("recording.wav", b"x" * (26 * 1024 * 1024))
        assert exc_info.value.size_bytes > exc_info.value.limit_bytes

    def test_audio_validation_error_base_class(self):
        assert issubclass(UnsupportedFormatError, AudioValidationError)
        assert issubclass(AudioTooLargeError, AudioValidationError)


class TestGetSupportedFormats:
    def test_returns_sorted_list(self):
        formats = get_supported_formats()
        assert isinstance(formats, list)
        assert len(formats) == 6
        assert formats == sorted(formats)


class TestEstimateBitrateKbps:
    def test_estimate_bitrate_basic(self):
        bitrate = estimate_bitrate_kbps(b"x" * 128000, 10.0)
        assert bitrate == 102.4

    def test_estimate_bitrate_zero_duration(self):
        bitrate = estimate_bitrate_kbps(b"x" * 1000, 0.0)
        assert bitrate == 0.0

    def test_estimate_bitrate_negative_duration(self):
        bitrate = estimate_bitrate_kbps(b"x" * 1000, -5.0)
        assert bitrate == 0.0

    def test_estimate_bitrate_rounding(self):
        bitrate = estimate_bitrate_kbps(b"x" * 320000, 20.0)
        assert bitrate == 128.0
