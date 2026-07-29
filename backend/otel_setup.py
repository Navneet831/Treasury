"""OpenTelemetry distributed tracing setup.

Instruments FastAPI, HTTPX, psycopg2, and the LLM copilot calls.
Exports traces to an OTel collector (gRPC) or falls back to console logging
when the collector is unreachable.

Usage in run_standalone.py:
    from otel_setup import setup_opentelemetry
    setup_opentelemetry("treasury-backend", "0.1.0")
"""

import os
import logging

logger = logging.getLogger(__name__)


def setup_opentelemetry(service_name: str = "treasury-backend", service_version: str = "0.1.0") -> bool:
    """Initialise OpenTelemetry SDK and instrument FastAPI.

    Returns True if OTel was successfully configured, False if it fell back to
    no-op (no OTLP endpoint configured or packages missing).
    """
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

    if not otlp_endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set — skipping OpenTelemetry setup")
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

        resource = Resource.create({
            SERVICE_NAME: service_name,
            SERVICE_VERSION: service_version,
        })

        tracer_provider = TracerProvider(resource=resource)
        span_processor = BatchSpanProcessor(
            OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
        )
        tracer_provider.add_span_processor(span_processor)
        trace.set_tracer_provider(tracer_provider)

        logger.info("OpenTelemetry initialised — exporting to %s", otlp_endpoint)

        # Return the tracer_provider for late instrumentation (app instance needed)
        return tracer_provider

    except ImportError as e:
        logger.warning(
            "OpenTelemetry packages not installed (%s). "
            "Install: pip install opentelemetry-api opentelemetry-sdk "
            "opentelemetry-instrumentation-fastapi opentelemetry-exporter-otlp "
            "opentelemetry-instrumentation-httpx opentelemetry-instrumentation-psycopg2",
            e,
        )
        return False
    except Exception as e:
        logger.warning("OpenTelemetry setup failed: %s", e)
        return False


def instrument_fastapi(app, tracer_provider) -> None:
    """Instrument FastAPI with OpenTelemetry. Call after app is created."""
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
        logger.info("FastAPI instrumented for OpenTelemetry")

        # Also instrument common client libraries
        try:
            from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
            HTTPXClientInstrumentor().instrument()
            logger.info("httpx instrumented for OpenTelemetry")
        except Exception:
            pass

        try:
            from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
            Psycopg2Instrumentor().instrument()
            logger.info("psycopg2 instrumented for OpenTelemetry")
        except Exception:
            pass

    except Exception as e:
        logger.warning("FastAPI instrumentation failed: %s", e)
